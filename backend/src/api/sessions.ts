import { deleteItem, putItem, updateItem } from "../lib/db.js";
import { badRequest, decodeCursor, encodeCursor, noContent, notFound, ok } from "../lib/http.js";
import type { DeleteAllSessionsResponse, FeedbackResponse, ForkSessionResponse, SessionDetailResponse, SessionListResponse, SessionResponse } from "../lib/api-types.js";
import { feedbackSchema, forkSessionSchema, parseJsonBody, renameSessionSchema } from "../lib/schemas.js";
import { deleteAllSessions, deleteSession, forkSession, listMessages, listSessions, messageSk, renameSession, requireSession } from "../lib/sessions.js";
import { route } from "./router.js";

const PAGE_SIZE = 50;
const EXCERPT_CHARS = 300;

export const sessionRoutes = [
  route("GET", "/api/sessions", async ({ user, query }) => {
    const q = query.q?.trim().toLowerCase();
    const all = (await listSessions(user.sub)).filter((s) => !q || s.title.toLowerCase().includes(q));
    const rawOffset = decodeCursor<{ offset: number }>(query.cursor)?.offset ?? 0;
    const offset = Number.isInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;
    const items = all.slice(offset, offset + PAGE_SIZE);
    const next = offset + PAGE_SIZE;
    return ok<SessionListResponse>({ items, nextCursor: next < all.length ? encodeCursor({ offset: next }) : null });
  }),

  route("GET", "/api/sessions/{id}", async ({ user, params }) => {
    const session = await requireSession(user.sub, params.id as string);
    return ok<SessionDetailResponse>({ session, messages: await listMessages(session.sessionId, { lenient: true }) });
  }),

  route("PATCH", "/api/sessions/{id}", async ({ user, params, rawBody }) => {
    const { title } = parseJsonBody(renameSessionSchema, rawBody);
    const session = await requireSession(user.sub, params.id as string);
    await renameSession(user.sub, session.sessionId, title);
    return ok<SessionResponse>({ session: { ...session, title } });
  }),

  route("DELETE", "/api/sessions/{id}", async ({ user, params }) => {
    const session = await requireSession(user.sub, params.id as string);
    await deleteSession(user.sub, session.sessionId);
    return noContent();
  }),

  route("DELETE", "/api/sessions", async ({ user }) => ok<DeleteAllSessionsResponse>(await deleteAllSessions(user.sub))),

  // Continue one model's side of a compare as a normal chat. Ownership is enforced by requireSession.
  route("POST", "/api/sessions/{id}/fork", async ({ user, params, rawBody }) => {
    const { modelId } = parseJsonBody(forkSessionSchema, rawBody);
    const session = await requireSession(user.sub, params.id as string);
    if (session.mode !== "compare") throw badRequest("Only compare sessions can be forked");
    if (!session.modelIds?.includes(modelId)) throw badRequest("That model is not part of this comparison");
    const fork = await forkSession(user.sub, session, await listMessages(session.sessionId), modelId);
    return { status: 201, body: { sessionId: fork.sessionId } satisfies ForkSessionResponse };
  }),

  route("POST", "/api/sessions/{id}/messages/{messageId}/feedback", async ({ user, params, rawBody }) => {
    const input = parseJsonBody(feedbackSchema, rawBody);
    const session = await requireSession(user.sub, params.id as string);
    const messages = await listMessages(session.sessionId);
    const index = messages.findIndex((m) => m.messageId === params.messageId);
    const message = messages[index];
    if (!message || message.role !== "assistant") throw notFound("Message not found");
    const prompt = messages.slice(0, index).reverse().find((m) => m.role === "user");
    const at = new Date().toISOString();
    const feedback: FeedbackResponse["feedback"] = { rating: input.rating, ...(input.comment ? { comment: input.comment } : {}), at };
    await updateItem(`SESSION#${session.sessionId}`, messageSk(message), { set: { feedback } });
    // One index row per message: replace the previous rating rather than stacking them.
    if (message.feedback) await deleteItem("FEEDBACK", `${message.feedback.at}#${message.messageId}`);
    await putItem({
      PK: "FEEDBACK",
      SK: `${at}#${message.messageId}`,
      sessionId: session.sessionId,
      messageId: message.messageId,
      rating: input.rating,
      comment: input.comment ?? "",
      modelId: message.modelId ?? "",
      reviewed: false,
      userEmail: user.email,
      promptExcerpt: (prompt?.content ?? "").slice(0, EXCERPT_CHARS),
      responseExcerpt: message.content.slice(0, EXCERPT_CHARS),
    });
    return ok<FeedbackResponse>({ feedback });
  }),
];
