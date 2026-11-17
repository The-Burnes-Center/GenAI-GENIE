import { addIfBelow, getItem, queryPartition, updateItem } from "./db.js";
import type { Usage } from "./types.js";

import { localDate } from "./tz.js";

/** Usage items are keyed by the local date in the settings time zone (UTC when none is given). */
export const dayKey = (date = new Date(), tz = "UTC"): string => localDate(date, tz);

const counterSk = (sub: string) => `COUNT#USER#${sub}`;
const usageSk = (modelId: string, sub: string) => `MODEL#${modelId}#USER#${sub}`;

export interface Reservation {
  /** Partition the reservation was made in, so a refund and the token totals hit the same local day. */
  pk: string;
  sub: string;
}

/**
 * Claim one request against the daily limit before the model is called (atomic and conditional, so
 * parallel requests cannot overshoot). Returns undefined when the limit is already reached.
 * limit 0 = unlimited: still counted, never refused. Changing the time zone mid-day starts a new day key.
 */
export async function reserveRequest(sub: string, limit: number, timezone: string, now = new Date()): Promise<Reservation | undefined> {
  const pk = `USAGE#${dayKey(now, timezone)}`;
  if (limit <= 0) {
    await updateItem(pk, counterSk(sub), { add: { requests: 1 } });
    return { pk, sub };
  }
  return (await addIfBelow(pk, counterSk(sub), "requests", 1, limit)) ? { pk, sub } : undefined;
}

/** Give a reserved request back (the turn failed). Best effort: a failed refund is logged, never thrown. */
export async function refundRequest(r: Reservation): Promise<void> {
  await updateItem(r.pk, counterSk(r.sub), { add: { requests: -1 } }).catch((err) =>
    console.error(JSON.stringify({ level: "error", message: "usage refund failed", error: String(err) })),
  );
}

/** Per-model totals for the admin report, added on completion (the limit counter is handled at reservation). */
export async function recordUsage(input: { modelId: string; sub: string; email: string; usage: Usage; reservation: Reservation }): Promise<void> {
  await updateItem(input.reservation.pk, usageSk(input.modelId, input.sub), {
    add: { requests: 1, inputTokens: input.usage.inputTokens, outputTokens: input.usage.outputTokens },
    set: { email: input.email },
  });
}

/** Requests this user has made today (local day) across all models. */
export async function countRequestsToday(sub: string, timezone: string, now = new Date()): Promise<number> {
  const item = await getItem<{ requests?: number }>(`USAGE#${dayKey(now, timezone)}`, counterSk(sub));
  return item?.requests ?? 0;
}

export interface UsageRow {
  day: string;
  modelId: string;
  sub: string;
  email: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export async function usageForDay(day: string): Promise<UsageRow[]> {
  const rows = await queryPartition<Record<string, unknown>>(`USAGE#${day}`, { skPrefix: "MODEL#" });
  return rows.map((r) => {
    const sk = String(r.SK);
    const split = sk.indexOf("#USER#");
    return {
      day,
      modelId: sk.slice("MODEL#".length, split),
      sub: sk.slice(split + "#USER#".length),
      email: String(r.email ?? ""),
      requests: Number(r.requests ?? 0),
      inputTokens: Number(r.inputTokens ?? 0),
      outputTokens: Number(r.outputTokens ?? 0),
    };
  });
}
