import type { AuditListResponse, AuditRecord, FeedbackListResponse, FeedbackRecord, ReviewFeedbackResponse, UsageReportResponse } from "../lib/api-types.js";
import { writeAudit } from "../lib/audit.js";
import { getItem, queryPage, updateItem } from "../lib/db.js";
import { badRequest, decodeCursor, encodeCursor, notFound, ok } from "../lib/http.js";
import { parseJsonBody, reviewFeedbackSchema } from "../lib/schemas.js";
import { dayKey, usageForDay, type UsageRow } from "../lib/usage.js";
import { route } from "./router.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 92;
const PAGE_SIZE = 50;

export interface FeedbackItem {
  SK: string;
  rating: string;
  modelId: string;
  reviewed?: boolean;
  [key: string]: unknown;
}

/** Sort keys are `{iso time}#{suffix}`, so the time is everything before the first `#`. */
const timeOf = (sk: string) => sk.slice(0, Math.max(sk.indexOf("#"), 0));
const text = (v: unknown) => (typeof v === "string" ? v : "");

export const toFeedbackRecord = (i: FeedbackItem): FeedbackRecord => ({
  id: i.SK,
  at: timeOf(i.SK),
  sessionId: text(i.sessionId),
  messageId: text(i.messageId),
  rating: i.rating === "up" ? "up" : "down",
  comment: text(i.comment),
  modelId: i.modelId,
  reviewed: i.reviewed ?? false,
  userEmail: text(i.userEmail),
  promptExcerpt: text(i.promptExcerpt),
  responseExcerpt: text(i.responseExcerpt),
});

export const toAuditRecord = (i: { SK: string } & Record<string, unknown>): AuditRecord => ({
  id: i.SK,
  at: timeOf(i.SK),
  actorSub: text(i.actorSub),
  actorEmail: text(i.actorEmail),
  action: text(i.action),
  target: text(i.target),
  details: (i.details ?? {}) as Record<string, unknown>,
});

/** Keyset cursor: the DynamoDB key of the last row returned, valid only for the partition it came from. */
export function decodeKeyCursor(cursor: string | undefined, pk: string): Record<string, unknown> | undefined {
  const decoded = decodeCursor<{ k?: { PK?: unknown; SK?: unknown } }>(cursor)?.k;
  if (decoded === undefined) return undefined;
  if (decoded.PK !== pk || typeof decoded.SK !== "string") throw badRequest("Invalid cursor");
  return { PK: decoded.PK, SK: decoded.SK };
}

/** One real page from a partition (newest first). Filters are applied while reading, so pages stay full and nothing is capped. */
export async function pagedPartition<T extends FeedbackItem | Record<string, unknown>>(
  pk: string,
  cursor: string | undefined,
  keep?: (item: T) => boolean,
  size = PAGE_SIZE,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const page = await queryPage<T & { PK: string; SK: string }>(pk, { size, startKey: decodeKeyCursor(cursor, pk), ...(keep ? { keep } : {}) });
  return { items: page.items, nextCursor: page.lastKey ? encodeCursor({ k: page.lastKey }) : null };
}

export function filterFeedback(
  items: FeedbackItem[],
  f: { rating?: string | undefined; modelId?: string | undefined; reviewed?: boolean | undefined },
): FeedbackItem[] {
  return items.filter(
    (i) =>
      (f.rating === undefined || i.rating === f.rating) &&
      (f.modelId === undefined || i.modelId === f.modelId) &&
      (f.reviewed === undefined || (i.reviewed ?? false) === f.reviewed),
  );
}
const MS_PER_DAY = 86_400_000;

type Totals = { requests: number; inputTokens: number; outputTokens: number };
const empty = (): Totals => ({ requests: 0, inputTokens: 0, outputTokens: 0 });

export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += MS_PER_DAY) {
    days.push(dayKey(new Date(t)));
  }
  return days;
}

export function aggregate(rows: UsageRow[], keyOf: (r: UsageRow) => string): (Totals & { key: string })[] {
  const map = new Map<string, Totals>();
  for (const r of rows) {
    const t = map.get(keyOf(r)) ?? empty();
    t.requests += r.requests;
    t.inputTokens += r.inputTokens;
    t.outputTokens += r.outputTokens;
    map.set(keyOf(r), t);
  }
  return [...map.entries()].map(([key, t]) => ({ key, ...t }));
}

export function resolveRange(fromParam: string | undefined, toParam: string | undefined, now = new Date(), tz = "UTC"): { from: string; to: string } {
  const to = toParam ?? dayKey(now, tz);
  const from = fromParam ?? dayKey(new Date(Date.parse(`${to}T00:00:00Z`) - (DEFAULT_RANGE_DAYS - 1) * MS_PER_DAY));
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw badRequest("from and to must be dates like 2026-11-17");
  }
  if (from > to) throw badRequest("from must not be after to");
  if (daysBetween(from, to).length > MAX_RANGE_DAYS) throw badRequest(`Choose a range of at most ${MAX_RANGE_DAYS} days`);
  return { from, to };
}

export const adminReportRoutes = [
  route("GET", "/api/admin/usage", async ({ query }) => {
    // The range is required (never defaulted) so a bare call cannot trigger a wide scan.
    if (!query.from || !query.to) throw badRequest("from and to are required, like ?from=2026-11-01&to=2026-11-17");
    const { from, to } = resolveRange(query.from, query.to);
    const perDay = await Promise.all(daysBetween(from, to).map(usageForDay));
    const rows = perDay.flat();
    return ok<UsageReportResponse>({
      from,
      to,
      totals: aggregate(rows, () => "all")[0] ?? { key: "all", ...empty() },
      byDay: aggregate(rows, (r) => r.day).map(({ key, ...t }) => ({ day: key, ...t })),
      byModel: aggregate(rows, (r) => r.modelId).map(({ key, ...t }) => ({ modelId: key, ...t })),
      byUser: aggregate(rows, (r) => `${r.sub}|${r.email}`).map(({ key, ...t }) => {
        const [sub = "", email = ""] = key.split("|");
        return { sub, email, ...t };
      }),
    });
  }, { admin: true }),

  route("GET", "/api/admin/feedback", async ({ query }) => {
    const { rating, modelId, reviewed } = query;
    if (rating !== undefined && rating !== "up" && rating !== "down") throw badRequest("rating must be up or down");
    if (reviewed !== undefined && reviewed !== "true" && reviewed !== "false") throw badRequest("reviewed must be true or false");
    const filter = { rating, modelId, reviewed: reviewed === undefined ? undefined : reviewed === "true" };
    const page = await pagedPartition<FeedbackItem>("FEEDBACK", query.cursor, (i) => filterFeedback([i], filter).length === 1);
    return ok<FeedbackListResponse>({ items: page.items.map(toFeedbackRecord), nextCursor: page.nextCursor });
  }, { admin: true }),

  // `id` is the item's sort key (`{at}#{messageId}`), URL-encoded by the client.
  route("PATCH", "/api/admin/feedback/{id}", async ({ user, params, rawBody }) => {
    const { reviewed } = parseJsonBody(reviewFeedbackSchema, rawBody);
    const id = params.id as string;
    if (!(await getItem("FEEDBACK", id))) throw notFound("Feedback not found");
    await updateItem("FEEDBACK", id, { set: { reviewed } });
    await writeAudit(user, "feedback.review", id, { reviewed });
    return ok<ReviewFeedbackResponse>({ id, reviewed });
  }, { admin: true }),

  route("GET", "/api/admin/audit", async ({ query }) => {
    const page = await pagedPartition<{ SK: string } & Record<string, unknown>>("AUDIT", query.cursor);
    return ok<AuditListResponse>({ items: page.items.map(toAuditRecord), nextCursor: page.nextCursor });
  }, { admin: true }),
];
