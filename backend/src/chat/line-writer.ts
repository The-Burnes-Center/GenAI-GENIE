import type { Writable } from "node:stream";
import { encodeLine, type ChatEvent } from "../lib/ndjson.js";

/**
 * Writes NDJSON lines in order and honours backpressure: when `write()` returns false the next line
 * waits for 'drain'. `emit` stays synchronous for callers; lines queue up behind a slow reader.
 *
 * Lambda response streaming gives no signal when the client disconnects, so a turn always runs to
 * completion (and is saved) even if nobody is listening. That is intended.
 */
export function createLineWriter(stream: Writable) {
  const queue: string[] = [];
  let pump: Promise<void> | undefined;

  async function run(): Promise<void> {
    for (let line = queue.shift(); line !== undefined; line = queue.shift()) {
      if (stream.writableEnded) return;
      if (!stream.write(line)) await new Promise<void>((resolve) => stream.once("drain", resolve));
    }
  }

  return {
    emit(event: ChatEvent): void {
      queue.push(encodeLine(event));
      pump ??= run().finally(() => {
        pump = undefined;
        if (queue.length > 0) void this.flush();
      });
    },
    /** Resolves once everything queued so far has been written. */
    async flush(): Promise<void> {
      while (pump || queue.length > 0) {
        if (!pump) pump = run().finally(() => (pump = undefined));
        await pump;
      }
    },
  };
}
