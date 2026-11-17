import type { Message as ConverseMessage } from "@aws-sdk/client-bedrock-runtime";
import type { Message, ModelEntry } from "./types.js";
import { CHARS_PER_TOKEN } from "./limits.js";
const TOKENS_PER_IMAGE = 1600;
const BYTES_PER_DOC_TOKEN = 4;
const BUDGET_FRACTION = 0.9;
export const MAX_TRIM_RETRIES = 2;

export const estimateTextTokens = (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);

export function estimateMessagesTokens(messages: ConverseMessage[]): number {
  let total = 0;
  for (const m of messages) {
    for (const block of m.content ?? []) {
      if (block.text) total += estimateTextTokens(block.text);
      else if (block.image) total += TOKENS_PER_IMAGE;
      else if (block.document?.source?.bytes) total += Math.ceil(block.document.source.bytes.length / BYTES_PER_DOC_TOKEN);
    }
  }
  return total;
}

/** Input tokens we are willing to send: 90% of the window left after reserving the full output. */
export const inputBudget = (model: Pick<ModelEntry, "contextWindow" | "maxOutputTokens">): number =>
  Math.max(1000, Math.floor((model.contextWindow - model.maxOutputTokens) * BUDGET_FRACTION));

/** Drop the oldest half of prior messages (rounded up). Never touches the current turn, which is not in `history`. */
export function dropOldestHalf<T>(history: T[]): T[] {
  return history.slice(Math.ceil(history.length / 2));
}

export function isTooLongError(err: unknown): boolean {
  const e = err as Error | undefined;
  return e?.name === "ValidationException" && /too long|context length|maximum context|too many tokens/i.test(e.message ?? "");
}

/** Trim only when the estimate exceeds the budget. Returns the history to send and whether anything was dropped. */
export function preTrim(
  history: Message[],
  estimate: (h: Message[]) => number,
  budget: number,
): { history: Message[]; trimmed: boolean } {
  let current = history;
  while (current.length > 0 && estimate(current) > budget) current = dropOldestHalf(current);
  return { history: current, trimmed: current.length !== history.length };
}
