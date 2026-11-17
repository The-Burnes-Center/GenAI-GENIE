import { describe, expect, it } from "vitest";
import { encodeLine } from "../src/lib/ndjson.js";

describe("encodeLine", () => {
  it("emits one JSON object per line", () => {
    expect(encodeLine({ type: "delta", text: "Hel" })).toBe('{"type":"delta","text":"Hel"}\n');
    expect(encodeLine({ type: "ping" })).toBe('{"type":"ping"}\n');
  });
  it("escapes newlines inside text so a line is never split", () => {
    const line = encodeLine({ type: "delta", text: "a\nb\r\nc" });
    expect(line.trimEnd().includes("\n")).toBe(false);
    expect(JSON.parse(line)).toEqual({ type: "delta", text: "a\nb\r\nc" });
  });
  it("round-trips every event shape", () => {
    const events = [
      { type: "session", sessionId: "s", messageId: "m", title: "t" },
      { type: "notice", code: "HISTORY_TRIMMED", message: "x" },
      { type: "done", usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0 }, latencyMs: 3, stopReason: "end_turn" },
      { type: "error", code: "REFUSED", message: "no" },
    ] as const;
    for (const e of events) expect(JSON.parse(encodeLine(e))).toEqual(e);
  });
});
