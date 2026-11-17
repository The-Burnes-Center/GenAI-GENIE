import { monotonicFactory } from "ulid";
import { batchDelete, deleteItem, getItem, putItem, queryPartition, updateItem } from "./db.js";
import { badRequest, notFound } from "./http.js";
import { copyAttachment, deleteObjects, deleteSessionObjects, offloadContent, resolveContent } from "./message-store.js";
import type { Attachment, Message, Session } from "./types.js";

const nextId = monotonicFactory();
export const newId = (): string => nextId();

const userPk = (sub: string) => `USER#${sub}`;
const sessionPk = (sessionId: string) => `SESSION#${sessionId}`;

const strip = <T extends object>(item: T): T => {
  const { PK: _pk, SK: _sk, ...rest } = item as T & { PK?: string; SK?: string };
  return rest as T;
};

export async function createSession(sub: string, session: Session): Promise<void> {
  await putItem({ PK: userPk(sub), SK: `SESSION#${session.sessionId}`, ...session });
}

export async function findSession(sub: string, sessionId: string): Promise<Session | undefined> {
  const item = await getItem<Session>(userPk(sub), `SESSION#${sessionId}`);
  return item ? strip(item) : undefined;
}

export async function requireSession(sub: string, sessionId: string): Promise<Session> {
  const session = await findSession(sub, sessionId);
  if (!session) throw notFound("Chat not found");
  return session;
}

export async function listSessions(sub: string): Promise<Session[]> {
  const items = await queryPartition<Session>(userPk(sub), { skPrefix: "SESSION#" });
  return items.map(strip).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Every stored message of a session (the Query is paginated to exhaustion). */
export async function listMessages(sessionId: string, opts: { lenient?: boolean } = {}): Promise<Message[]> {
  const items = await queryPartition<Message>(sessionPk(sessionId), { skPrefix: "MSG#" });
  return resolveContent(items.map(strip), opts);
}

export const messageSk = (m: Pick<Message, "createdAt" | "messageId">) => `MSG#${m.createdAt}#${m.messageId}`;

export async function putMessage(message: Message): Promise<void> {
  const stored = await offloadContent(message);
  await putItem({ PK: sessionPk(message.sessionId), SK: messageSk(message), ...stored });
}

export async function touchSession(sub: string, sessionId: string, addedMessages: number, extra: Record<string, unknown> = {}): Promise<void> {
  await updateItem(userPk(sub), `SESSION#${sessionId}`, {
    set: { updatedAt: new Date().toISOString(), ...extra },
    add: { messageCount: addedMessages },
  });
}

export async function renameSession(sub: string, sessionId: string, title: string): Promise<void> {
  await updateItem(userPk(sub), `SESSION#${sessionId}`, { set: { title } });
}

/** Attachment objects referenced by a session's messages, plus their cached text extractions. */
export function attachmentKeys(rows: { attachments?: { key: string }[] }[]): string[] {
  return rows.flatMap((r) => (r.attachments ?? []).flatMap((a) => [a.key, `${a.key}.txt`]));
}

export async function deleteSession(sub: string, sessionId: string): Promise<void> {
  const rows = await queryPartition<{ PK: string; SK: string; attachments?: { key: string }[] }>(sessionPk(sessionId));
  await deleteObjects(attachmentKeys(rows));
  await batchDelete(rows.map(({ PK, SK }) => ({ PK, SK })));
  await deleteSessionObjects(sessionId);
  await deleteItem(userPk(sub), `SESSION#${sessionId}`);
}

const DELETE_PARALLELISM = 5;
const DELETE_ALL_BUDGET_MS = 20_000;

/**
 * Delete the user's sessions in parallel chunks within a time budget.
 * `remaining` > 0 means the caller should call again.
 */
export async function deleteAllSessions(sub: string, budgetMs = DELETE_ALL_BUDGET_MS): Promise<{ deleted: number; remaining: number }> {
  const sessions = await listSessions(sub);
  const deadline = Date.now() + budgetMs;
  let deleted = 0;
  for (let i = 0; i < sessions.length && Date.now() < deadline; i += DELETE_PARALLELISM) {
    const chunk = sessions.slice(i, i + DELETE_PARALLELISM);
    await Promise.all(chunk.map((s) => deleteSession(sub, s.sessionId)));
    deleted += chunk.length;
  }
  return { deleted, remaining: sessions.length - deleted };
}

/**
 * The assistant message a retry may replace, and the user prompt it answered. Retryable: a failed reply, or the
 * latest reply (the latest one of its own model in a compare session) so "Try again" can regenerate a good answer.
 */
export function findRetryPair(session: Session, messages: Message[], assistantId: string): { assistant: Message; user?: Message } | undefined {
  const index = messages.findIndex((m) => m.messageId === assistantId);
  const assistant = messages[index];
  if (!assistant || assistant.role !== "assistant") return undefined;
  if (!assistant.error && !isLatestReply(session, messages, assistant)) return undefined;
  const user = messages
    .slice(0, index)
    .reverse()
    .find((m) => m.role === "user" && m.modelId === assistant.modelId && (assistant.turn === undefined || m.turn === assistant.turn));
  return { assistant, ...(user ? { user } : {}) };
}

function isLatestReply(session: Session, messages: Message[], assistant: Message): boolean {
  const replies = messages.filter((m) => m.role === "assistant" && (session.mode !== "compare" || m.modelId === assistant.modelId));
  return replies.at(-1)?.messageId === assistant.messageId;
}

/**
 * Delete a turn (the reply plus its prompt) so the client can resend the prompt: a failed reply, or the latest
 * reply when the user asks for another answer. Only messages of the caller's own session are reachable; any
 * other message is a 400.
 */
export async function discardFailedTurn(sub: string, session: Session, messages: Message[], assistantId: string): Promise<string[]> {
  const pair = findRetryPair(session, messages, assistantId);
  if (!pair) throw badRequest("Only the latest reply, or a failed one, can be tried again");
  const doomed = [pair.assistant, ...(pair.user ? [pair.user] : [])];
  for (const m of doomed) await deleteItem(sessionPk(session.sessionId), messageSk(m));
  await touchSession(sub, session.sessionId, -doomed.length);
  return doomed.map((m) => m.messageId);
}

/**
 * Copy one model's side of a compare session into a new chat session.
 * Failed turns (error replies and the prompts they answered) are left behind.
 */
export async function forkSession(sub: string, source: Session, messages: Message[], modelId: string): Promise<Session> {
  const mine = messages.filter((m) => m.modelId === modelId);
  const failedTurns = new Set(mine.filter((m) => m.error).map((m) => m.turn));
  const keep = mine.filter((m) => !m.error && !(m.turn !== undefined && failedTurns.has(m.turn)));
  const now = new Date().toISOString();
  const fork: Session = {
    sessionId: newId(),
    title: source.title,
    mode: "chat",
    modelId,
    ...(source.workspaceId ? { workspaceId: source.workspaceId } : {}),
    ...(source.templateId ? { templateId: source.templateId } : {}),
    createdAt: now,
    updatedAt: now,
    messageCount: keep.length,
  };
  // Copy attachments first, so a failure here leaves no session behind. Copies are shared per source file.
  const copies = new Map<string, Promise<Attachment>>();
  const copyOnce = (a: Attachment) => {
    const existing = copies.get(a.key);
    if (existing) return existing;
    const created = copyAttachment(sub, a);
    copies.set(a.key, created);
    return created;
  };
  try {
    const rewritten = await Promise.all(
      keep.map(async (m) => {
        const { contentKey: _k, ...rest } = m;
        const attachments = m.attachments ? await Promise.all(m.attachments.map(copyOnce)) : undefined;
        return { ...rest, ...(attachments ? { attachments } : {}), messageId: newId(), sessionId: fork.sessionId } as Message;
      }),
    );
    await createSession(sub, fork);
    for (const m of rewritten) await putMessage(m);
  } catch (err) {
    // Roll back whatever was created: the session and messages, and only the objects this fork copied.
    await deleteSession(sub, fork.sessionId).catch(() => undefined);
    const copied = await Promise.allSettled([...copies.values()]);
    const own = copied.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])).filter((a) => !keep.some((m) => m.attachments?.some((o) => o.key === a.key)));
    await deleteObjects(own.flatMap((a) => [a.key, `${a.key}.txt`])).catch(() => undefined);
    throw err;
  }
  return fork;
}
