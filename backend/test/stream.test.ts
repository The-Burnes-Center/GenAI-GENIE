import type { ConverseStreamOutput } from "@aws-sdk/client-bedrock-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatFailure } from "../src/chat/errors.js";
import { startPinger } from "../src/chat/pinger.js";
import { runChat } from "../src/chat/run.js";
import { streamModel, type ConverseStreamSender } from "../src/chat/stream.js";
import { dropOldestHalf, estimateMessagesTokens, inputBudget, isTooLongError, preTrim } from "../src/lib/context.js";
import type { ChatEvent } from "../src/lib/ndjson.js";
import { emptyContext, model, msg, prepared, SONNET } from "./fixtures.js";

async function* events(list: ConverseStreamOutput[]) {
  for (const e of list) yield e;
}

const okStream = (): ConverseStreamOutput[] => [
  { contentBlockDelta: { delta: { reasoningContent: { text: "thinking" } }, contentBlockIndex: 0 } },
  { contentBlockDelta: { delta: { text: "Hel" }, contentBlockIndex: 1 } },
  { contentBlockDelta: { delta: { text: "lo" }, contentBlockIndex: 1 } },
  { messageStop: { stopReason: "end_turn" } },
  { metadata: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cacheReadInputTokens: 4 }, metrics: { latencyMs: 1 } } },
];

const tooLong = () => Object.assign(new Error("Input is too long for requested model"), { name: "ValidationException" });

const history = (n: number) =>
  Array.from({ length: n }, (_, i) => msg(i % 2 === 0 ? "user" : "assistant", `m${i}`, i + 1));

afterEach(() => vi.useRealTimers());

describe("streamModel", () => {
  it("streams reasoning and deltas and reports usage", async () => {
    const out: ChatEvent[] = [];
    const send: ConverseStreamSender = async () => ({ stream: events(okStream()) });
    const r = await streamModel(prepared(model(SONNET)), emptyContext(), (e) => out.push(e), () => 60_000, send);
    expect(out).toEqual([
      { type: "reasoning", text: "thinking" }, { type: "delta", text: "Hel" }, { type: "delta", text: "lo" },
    ]);
    expect(r).toMatchObject({ text: "Hello", stopReason: "end_turn", usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 4 } });
  });

  it("on a too-long error drops the oldest half, retries and emits one notice", async () => {
    const calls: number[] = [];
    const send: ConverseStreamSender = async (input) => {
      calls.push(input.messages?.length ?? 0);
      if (calls.length === 1) throw tooLong();
      return { stream: events(okStream()) };
    };
    const out: ChatEvent[] = [];
    const p = prepared(model(SONNET), { history: history(8) });
    await streamModel(p, emptyContext(), (e) => out.push(e), () => 60_000, send);
    // 8 prior messages + current turn = 9 messages; after dropping 4 -> 4 prior + current (merged roles considered).
    expect(calls[0]).toBeGreaterThan(calls[1] as number);
    expect(out.filter((e) => e.type === "notice")).toEqual([
      expect.objectContaining({ code: "HISTORY_TRIMMED" }),
    ]);
  });

  it("retries at most twice, then reports CONTEXT_TOO_LONG", async () => {
    let calls = 0;
    const send: ConverseStreamSender = async () => { calls++; throw tooLong(); };
    const p = prepared(model(SONNET), { history: history(16) });
    await expect(streamModel(p, emptyContext(), () => undefined, () => 60_000, send)).rejects.toMatchObject({ code: "CONTEXT_TOO_LONG" });
    expect(calls).toBe(3); // first try + two retries
  });

  it("reports CONTEXT_TOO_LONG immediately when the current turn alone is too long", async () => {
    let calls = 0;
    const send: ConverseStreamSender = async () => { calls++; throw tooLong(); };
    await expect(streamModel(prepared(model(SONNET)), emptyContext(), () => undefined, () => 60_000, send)).rejects.toBeInstanceOf(ChatFailure);
    expect(calls).toBe(1);
  });

  it("maps throttling, refusal and other failures to their codes", async () => {
    const fail = (err: Error): ConverseStreamSender => async () => { throw err; };
    const run = (send: ConverseStreamSender) => streamModel(prepared(model(SONNET)), emptyContext(), () => undefined, () => 60_000, send);
    await expect(run(fail(Object.assign(new Error("slow down"), { name: "ThrottlingException" })))).rejects.toMatchObject({ code: "BEDROCK_THROTTLED" });
    await expect(run(fail(new Error("boom")))).rejects.toMatchObject({ code: "BEDROCK_ERROR" });
    const refused: ConverseStreamSender = async () => ({ stream: events([{ messageStop: { stopReason: "guardrail_intervened" } }]) });
    await expect(run(refused)).rejects.toMatchObject({ code: "REFUSED" });
  });

  it("does not retry once output has started", async () => {
    let calls = 0;
    const send: ConverseStreamSender = async () => {
      calls++;
      async function* broken(): AsyncGenerator<ConverseStreamOutput> {
        yield { contentBlockDelta: { delta: { text: "x" }, contentBlockIndex: 0 } };
        throw tooLong();
      }
      return { stream: broken() };
    };
    const p = prepared(model(SONNET), { history: history(4) });
    await expect(streamModel(p, emptyContext(), () => undefined, () => 60_000, send)).rejects.toBeInstanceOf(ChatFailure);
    expect(calls).toBe(1);
  });

  it("leaves no timers behind", async () => {
    vi.useFakeTimers();
    const send: ConverseStreamSender = async () => ({ stream: events(okStream()) });
    await streamModel(prepared(model(SONNET)), emptyContext(), () => undefined, () => 60_000, send);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("context helpers", () => {
  it("dropOldestHalf rounds up and keeps the newest", () => {
    expect(dropOldestHalf([1, 2, 3, 4, 5])).toEqual([4, 5]);
    expect(dropOldestHalf([1])).toEqual([]);
  });

  it("detects too-long validation errors only", () => {
    expect(isTooLongError(tooLong())).toBe(true);
    expect(isTooLongError(Object.assign(new Error("maximum context length exceeded"), { name: "ValidationException" }))).toBe(true);
    expect(isTooLongError(Object.assign(new Error("bad param"), { name: "ValidationException" }))).toBe(false);
    expect(isTooLongError(Object.assign(new Error("too long"), { name: "ThrottlingException" }))).toBe(false);
  });

  it("pre-trims only beyond 90% of (window - output)", () => {
    const m = { contextWindow: 10_000, maxOutputTokens: 1_000 };
    expect(inputBudget(m)).toBe(8100);
    const h = history(8);
    const fixed = preTrim(h, () => 8100, inputBudget(m));
    expect(fixed.trimmed).toBe(false);
    const trimmed = preTrim(h, (x) => x.length * 2000, inputBudget(m));
    expect(trimmed.trimmed).toBe(true);
    expect(trimmed.history.length).toBeLessThanOrEqual(4);
  });

  it("estimates text, images and documents", () => {
    const tokens = estimateMessagesTokens([
      { role: "user", content: [{ text: "x".repeat(350) }, { image: { format: "png", source: { bytes: new Uint8Array(1) } } }] },
    ]);
    expect(tokens).toBe(100 + 1600);
  });
});

describe("ping timer", () => {
  it("emits after every 10 s of silence until stopped and then leaves no timer", () => {
    vi.useFakeTimers();
    const out: ChatEvent[] = [];
    const pinger = startPinger((e) => out.push(e), 10_000);
    vi.advanceTimersByTime(25_000);
    expect(out).toHaveLength(2);
    pinger.stop();
    vi.advanceTimersByTime(60_000);
    expect(out).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps pinging during silence after output has started, and touch() defers it", () => {
    vi.useFakeTimers();
    const out: ChatEvent[] = [];
    const pinger = startPinger((e) => out.push(e), 10_000);
    vi.advanceTimersByTime(9_000);
    pinger.touch(); // a token arrived
    vi.advanceTimersByTime(9_000);
    expect(out).toHaveLength(0);
    vi.advanceTimersByTime(30_000); // then the model goes quiet mid-answer
    expect(out.length).toBeGreaterThanOrEqual(2);
    pinger.stop();
  });

  it("runChat stops pinging after a failure and ends with exactly one error", async () => {
    vi.useFakeTimers();
    const out: ChatEvent[] = [];
    await runChat({
      user: { sub: "u", email: "u@x.org", username: "u", isAdmin: false, status: "active" },
      rawBody: "{not json",
      requestId: "r1",
      emit: (e) => out.push(e),
      remainingMs: () => 60_000,
    });
    vi.advanceTimersByTime(60_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(out.map((e) => e.type)).toEqual(["error"]);
    expect(out[0]).toMatchObject({ code: "BAD_REQUEST" });
  });
});
