import type { ChatEvent } from "../lib/ndjson.js";

export const PING_INTERVAL_MS = 10_000;

export interface Pinger {
  /** Call whenever something else was written, so pings only fill genuine silence. */
  touch(): void;
  stop(): void;
}

/**
 * Emit `ping` whenever nothing has been written for `intervalMs`, so CloudFront's 60 s
 * read timeout never fires, whether the model is thinking or pausing mid-answer.
 * The timer never keeps the process alive.
 */
export function startPinger(emit: (e: ChatEvent) => void, intervalMs = PING_INTERVAL_MS, now: () => number = Date.now): Pinger {
  let last = now();
  const timer = setInterval(() => {
    if (now() - last < intervalMs) return;
    last = now();
    emit({ type: "ping" });
  }, Math.max(1, Math.floor(intervalMs / 2)));
  timer.unref?.();
  return { touch: () => void (last = now()), stop: () => clearInterval(timer) };
}
