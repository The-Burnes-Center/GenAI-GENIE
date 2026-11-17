import { getModel, getSettings, getTemplate } from "../lib/catalog.js";
import { clampMaxTokens, historyForModel, makeTitle, planAttachments, type AttachmentPlan, type LoadedAttachment, type Source } from "../lib/converse.js";
import { badRequest } from "../lib/http.js";
import { retrieveFromWorkspace } from "../lib/kb.js";
import type { ChatRequest } from "../lib/schemas.js";
import { createSession, discardFailedTurn, listMessages, newId, requireSession } from "../lib/sessions.js";
import { nextMidnight } from "../lib/tz.js";
import { reserveRequest, type Reservation } from "../lib/usage.js";
import { requireReadable } from "../lib/workspaces.js";
import type { AuthUser, Citation, Message, ModelEntry, Session, Settings, Template } from "../lib/types.js";
import { resolveAttachments, type Notice } from "./attachments.js";
import { ChatFailure } from "./errors.js";

export interface Prepared {
  req: ChatRequest;
  model: ModelEntry;
  settings: Settings;
  session: Session;
  isNewSession: boolean;
  /** Every stored message of the session (all models), used for turn counting. */
  allMessages: Message[];
  /** Messages visible to this model. */
  history: Message[];
  template?: Template;
  maxTokens: number;
  /** 0-based turn number: client-sent, else the count of earlier user turns for this model. */
  turn: number;
  plan: AttachmentPlan;
  reservation: Reservation;
  workspaceId?: string;
}

export interface Context {
  citations: Citation[];
  sources: Source[];
  attachments: LoadedAttachment[];
  /** Attachments of earlier user messages, resent each turn within Converse's per-request limits. */
  historyAttachments: Map<string, LoadedAttachment[]>;
  /** Limit, expiry and truncation notices to show the user. */
  notices: Notice[];
  /** Documents that were converted to text for this model. */
  textAttachments: string[];
}

/** Everything that can reject the request before any session exists. */
export interface Checked {
  model: ModelEntry;
  settings: Settings;
  template?: Template;
  plan: AttachmentPlan;
  /** The daily-limit slot claimed for this turn; the caller refunds it if the turn fails. */
  reservation: Reservation;
}

export async function checkRequest(user: AuthUser, req: ChatRequest): Promise<Checked> {
  const [settings, model] = await Promise.all([getSettings(), getModel(req.modelId)]);
  if (!model || !model.enabled) throw new ChatFailure("MODEL_DISABLED", "That model is not available. Choose another.");
  if (req.mode === "compare") {
    const ids = req.compareModelIds ?? [];
    if (!ids.includes(req.modelId)) throw badRequest("compareModelIds must include modelId");
    if (ids.length < 2) throw badRequest("Compare needs at least two models");
    if (ids.length > settings.maxCompareModels) throw badRequest(`You can compare up to ${settings.maxCompareModels} models`);
  }
  const plan = planAttachments(model, req.attachments);
  if (req.workspaceId) await requireReadable(user, req.workspaceId);
  let template: Template | undefined;
  if (req.templateId) {
    template = await getTemplate(req.templateId);
    if (!template?.enabled) throw badRequest("That template is not available");
  }
  // Last on purpose: every cheap rejection above must not cost the user a message.
  const reservation = await reserveRequest(user.sub, settings.dailyMessageLimit, settings.timezone);
  if (!reservation) {
    throw new ChatFailure(
      "LIMIT_REACHED",
      `You have reached today's limit of ${settings.dailyMessageLimit} messages. It resets at midnight (${settings.timezone}).`,
      nextMidnight(new Date(), settings.timezone).toISOString(),
    );
  }
  return { model, settings, template, plan, reservation };
}

export function newSessionFor(req: ChatRequest, now: string): Session {
  return {
    sessionId: newId(),
    title: makeTitle(req.prompt),
    mode: req.mode,
    modelId: req.modelId,
    ...(req.mode === "compare" ? { modelIds: req.compareModelIds } : {}),
    ...(req.workspaceId ? { workspaceId: req.workspaceId } : {}),
    ...(req.templateId ? { templateId: req.templateId } : {}),
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
}

/** Load the caller's session (or create one) and the history this model should see. */
export async function openSession(user: AuthUser, req: ChatRequest, base: Checked): Promise<Prepared> {
  const now = new Date().toISOString();
  let session: Session;
  let allMessages: Message[] = [];
  const isNewSession = !req.sessionId;
  if (req.sessionId) {
    session = await requireSession(user.sub, req.sessionId);
    if (session.mode !== req.mode) throw badRequest(`This chat is in ${session.mode} mode`);
    allMessages = await listMessages(session.sessionId);
    if (req.retryOfMessageId) {
      // Drop the replaced pair (failed, or the latest answer being regenerated) first so the prompt is not seen twice.
      const removed = await discardFailedTurn(user.sub, session, allMessages, req.retryOfMessageId);
      allMessages = allMessages.filter((m) => !removed.includes(m.messageId));
    }
  } else {
    if (req.retryOfMessageId) throw badRequest("retryOfMessageId needs a sessionId");
    session = newSessionFor(req, now);
    await createSession(user.sub, session);
  }
  const workspaceId = req.workspaceId ?? session.workspaceId;
  const template = base.template ?? (session.templateId ? await getTemplate(session.templateId) : undefined);
  return {
    req,
    ...base,
    template: template?.enabled ? template : undefined,
    session,
    isNewSession,
    allMessages,
    history: historyForModel(allMessages, req.modelId, req.mode),
    maxTokens: clampMaxTokens(undefined, base.model.maxOutputTokens),
    turn: req.turn ?? allMessages.filter((m) => m.role === "user" && (req.mode !== "compare" || m.modelId === req.modelId)).length,
    workspaceId,
  };
}

const RETRIEVAL_QUERY_CHARS = 1500;
const PROMPT_HEAD_CHARS = 600;
const PROMPT_TAIL_CHARS = 900;
/** The previous user turn only needs enough to carry the topic. */
const PREVIOUS_TURN_CHARS = 300;

/**
 * Query for retrieval: the previous user turn (so "and the deadline?" still works) plus the current prompt.
 * A long prompt keeps its head and its tail, because the actual question usually comes last. Total cap 1,500.
 */
export function buildRetrievalQuery(prompt: string, previousUser: string | undefined): string {
  const previous = previousUser ? previousUser.slice(0, PREVIOUS_TURN_CHARS) : "";
  const budget = RETRIEVAL_QUERY_CHARS - (previous ? previous.length + 1 : 0);
  let current = prompt;
  if (prompt.length > budget) {
    // Keep the start (context) and the end (usually the actual question); 600:900 when nothing else is competing.
    const head = Math.round((budget * PROMPT_HEAD_CHARS) / (PROMPT_HEAD_CHARS + PROMPT_TAIL_CHARS));
    current = prompt.slice(0, head) + prompt.slice(prompt.length - (budget - head));
  }
  return previous ? `${previous}\n${current}` : current;
}

/** Workspace retrieval and attachments (current and earlier turns), fetched in parallel. */
export async function gatherContext(user: AuthUser, p: Prepared): Promise<Context> {
  const previousUser = [...p.history].reverse().find((m) => m.role === "user")?.content;
  const retrieval = async () => {
    if (!p.workspaceId) return { citations: [], sources: [] };
    if (!p.req.workspaceId) await requireReadable(user, p.workspaceId); // checked up front when sent in the request
    return retrieveFromWorkspace(p.workspaceId, buildRetrievalQuery(p.req.prompt, previousUser), p.settings.retrievalTopK);
  };
  const [{ citations, sources }, resolved] = await Promise.all([
    retrieval(),
    resolveAttachments(user.sub, p.history, p.req.attachments, p.model),
  ]);
  return {
    citations,
    sources,
    attachments: resolved.current,
    historyAttachments: resolved.byMessage,
    notices: resolved.notices,
    textAttachments: resolved.textFiles,
  };
}
