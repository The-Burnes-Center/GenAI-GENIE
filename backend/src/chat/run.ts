import { deleteItem } from "../lib/db.js";
import type { ChatEvent } from "../lib/ndjson.js";
import { chatRequestSchema, parseJsonBody } from "../lib/schemas.js";
import { newId, putMessage, renameSession, touchSession } from "../lib/sessions.js";
import { recordUsage, refundRequest, type Reservation } from "../lib/usage.js";
import type { AuthUser, Message } from "../lib/types.js";
import { toErrorEvent } from "./errors.js";
import { startPinger } from "./pinger.js";
import { checkRequest, gatherContext, openSession, type Context, type Prepared } from "./prepare.js";
import { streamModel, type Progress, type StreamResult } from "./stream.js";
import { generateTitle } from "./title.js";

export interface RunInput {
  user: AuthUser;
  rawBody: string | undefined;
  requestId: string;
  emit: (event: ChatEvent) => void;
  remainingMs: () => number;
}

/** What the stream produced besides the answer text, kept on the assistant message. */
export interface StreamExtras {
  reasoning: string;
  notices: { code: string; message: string }[];
  thinkingMs?: number;
}

/** Fold events into extras. `streamStart` is when the model call began. */
export function collectExtras(extras: StreamExtras, e: ChatEvent, streamStart: number, now = Date.now()): void {
  if (e.type === "reasoning") extras.reasoning += e.text;
  else if (e.type === "notice") extras.notices.push({ code: e.code, message: e.message });
  else if (e.type === "delta" && extras.reasoning && extras.thinkingMs === undefined) extras.thinkingMs = now - streamStart;
}

const extraFields = (x: StreamExtras) => ({
  ...(x.reasoning ? { reasoning: x.reasoning } : {}),
  ...(x.thinkingMs !== undefined ? { thinkingMs: x.thinkingMs } : {}),
  ...(x.notices.length ? { notices: x.notices } : {}),
});

/** Saved before the model is called, so a crash or timeout later never loses what the user asked. */
export async function persistUserMessage(user: AuthUser, p: Prepared, startedAt: string): Promise<void> {
  const { req, session } = p;
  await putMessage({
    messageId: newId(),
    sessionId: session.sessionId,
    role: "user",
    content: req.prompt,
    modelId: req.modelId,
    turn: p.turn,
    ...(req.attachments.length ? { attachments: req.attachments } : {}),
    createdAt: startedAt,
  } satisfies Message);
  await touchSession(user.sub, session.sessionId, 1, req.mode === "chat" ? { modelId: req.modelId } : {});
}

async function persistAnswer(user: AuthUser, p: Prepared, ctx: Context, result: StreamResult, assistantId: string, extras: StreamExtras): Promise<void> {
  await putMessage({
    messageId: assistantId,
    sessionId: p.session.sessionId,
    role: "assistant",
    content: result.text,
    modelId: p.req.modelId,
    turn: p.turn,
    ...(ctx.citations.length ? { citations: ctx.citations } : {}),
    usage: result.usage,
    latencyMs: result.latencyMs,
    stopReason: result.stopReason,
    ...extraFields(extras),
    createdAt: new Date().toISOString(),
  });
  await touchSession(user.sub, p.session.sessionId, 1);
  await recordUsage({ modelId: p.req.modelId, sub: user.sub, email: user.email, usage: result.usage, reservation: p.reservation });
}

/**
 * A failed answer: the partial text that did stream (if any), the stop reason and the error,
 * so a reload shows what the user saw plus a Retry.
 */
export async function persistFailedAnswer(
  user: AuthUser,
  p: Prepared,
  assistantId: string,
  error: { code: string; message: string },
  partial: Progress,
  extras: StreamExtras,
): Promise<void> {
  await putMessage({
    messageId: assistantId,
    sessionId: p.session.sessionId,
    role: "assistant",
    content: partial.text,
    modelId: p.req.modelId,
    turn: p.turn,
    stopReason: partial.stopReason ?? "error",
    error,
    ...extraFields(extras),
    createdAt: new Date().toISOString(),
  });
  await touchSession(user.sub, p.session.sessionId, 1);
}

async function emitGeneratedTitle(p: Prepared, user: AuthUser, reply: string, emit: (e: ChatEvent) => void): Promise<void> {
  const title = await generateTitle(p.req.prompt, reply, p.settings.titleModelId);
  if (!title || title === p.session.title) return;
  await renameSession(user.sub, p.session.sessionId, title);
  emit({ type: "title", sessionId: p.session.sessionId, title });
}

const logError = (requestId: string, message: string, err: unknown) =>
  console.error(JSON.stringify({ level: "error", requestId, message, error: String(err) }));

/**
 * Run one chat turn and report progress as events. Always finishes with exactly
 * one `done` or `error` event (a `title` may follow `done`) and never throws.
 * Pings fill every 10 s of silence until the turn ends, so proxies never time out.
 */
export async function runChat(input: RunInput): Promise<void> {
  const { user, requestId } = input;
  const extras: StreamExtras = { reasoning: "", notices: [] };
  const partial: Progress = { text: "" };
  let streamStart = Date.now();
  const pinger = startPinger((e) => input.emit(e));
  const emit = (e: ChatEvent) => {
    pinger.touch();
    collectExtras(extras, e, streamStart);
    input.emit(e);
    if (e.type === "done" || e.type === "error") pinger.stop();
  };
  let prepared: Prepared | undefined;
  let assistantId = "";
  let userSaved = false;
  let reservation: Reservation | undefined;
  try {
    const req = parseJsonBody(chatRequestSchema, input.rawBody);
    const startedAt = new Date().toISOString();
    const checked = await checkRequest(user, req);
    reservation = checked.reservation; // claimed: refunded below unless the turn completes
    prepared = await openSession(user, req, checked);
    assistantId = newId();
    emit({ type: "session", sessionId: prepared.session.sessionId, messageId: assistantId, title: prepared.session.title });
    const ctx = await gatherContext(user, prepared);
    if (ctx.textAttachments.length > 0) {
      emit({ type: "notice", code: "ATTACHMENT_AS_TEXT", message: `${prepared.model.label} cannot read files directly, so the text of ${ctx.textAttachments.join(", ")} was extracted and sent instead. Layout and images are not included.` });
    }
    for (const n of ctx.notices) emit({ type: "notice", code: n.code, message: n.message });
    if (ctx.citations.length > 0) emit({ type: "citations", items: ctx.citations });
    await persistUserMessage(user, prepared, startedAt);
    userSaved = true;
    streamStart = Date.now();
    const result = await streamModel(prepared, ctx, emit, input.remainingMs, undefined, partial);
    await persistAnswer(user, prepared, ctx, result, assistantId, extras).catch((err) => {
      logError(requestId, "persist failed", err);
      emit({ type: "notice", code: "SAVE_FAILED", message: "This answer could not be saved to your history. Copy it now if you need it." });
    });
    emit({ type: "done", usage: result.usage, latencyMs: result.latencyMs, stopReason: result.stopReason });
    if (prepared.isNewSession) await emitGeneratedTitle(prepared, user, result.text, emit).catch(() => undefined);
  } catch (err) {
    const event = toErrorEvent(err, requestId);
    if (reservation) await refundRequest(reservation);
    if (prepared && userSaved) {
      await persistFailedAnswer(user, prepared, assistantId, { code: event.code, message: event.message }, partial, extras).catch((e) =>
        logError(requestId, "failed-answer persist failed", e),
      );
    } else if (prepared?.isNewSession) {
      // Nothing was stored for this chat or comparison, so do not leave an empty one in the sidebar.
      await deleteItem(`USER#${user.sub}`, `SESSION#${prepared.session.sessionId}`).catch(() => undefined);
    }
    emit(event);
  } finally {
    pinger.stop();
  }
}
