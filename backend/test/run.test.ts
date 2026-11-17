import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbMockModule, resetDb, store } from "./dbmock.js";
import { DEFAULT_MODELS, DEFAULT_SETTINGS } from "../src/lib/defaults.js";
import type { ChatEvent } from "../src/lib/ndjson.js";

vi.mock("../src/lib/db.js", async () => (await import("./dbmock.js")).dbMockModule);
vi.mock("../src/lib/aws.js", async () => (await import("./s3mock.js")).awsMockModule);

const order: string[] = [];
const gatherFails = vi.hoisted(() => ({ value: false }));
const streamMock = vi.hoisted(() => ({ streamModel: vi.fn() }));
vi.mock("../src/chat/stream.js", () => streamMock);
vi.mock("../src/chat/title.js", () => ({ generateTitle: async () => "A fine title" }));
vi.mock("../src/chat/prepare.js", () => ({
  checkRequest: async () => ({ reservation: { pk: 'USAGE#2026-11-17', sub: 'u1' } }),
  gatherContext: async () => { if (gatherFails.value) throw new Error("gather boom"); return { citations: [], sources: [], attachments: [], historyAttachments: new Map(), notices: [{ code: "ATTACHMENT_EXPIRED", message: "x.pdf is no longer available" }], textAttachments: [] }; },
  openSession: async (_u: unknown, req: { prompt: string; modelId: string }) => ({
    req: { ...req, attachments: [], mode: (req as { mode?: string }).mode ?? "chat" },
    model: DEFAULT_MODELS[0],
    settings: DEFAULT_SETTINGS,
    session: { sessionId: "s1", title: "t0", mode: (req as { mode?: string }).mode ?? "chat", modelId: req.modelId, createdAt: "", updatedAt: "", messageCount: 0 },
    reservation: { pk: 'USAGE#2026-11-17', sub: 'u1' }, isNewSession: true, allMessages: [], history: [], maxTokens: 10, turn: 0, plan: { kinds: [], asText: [] },
  }),
}));

const { runChat } = await import("../src/chat/run.js");
const user = { sub: "u1", email: "u@x.org", username: "u1", isAdmin: false, status: "active" as const };
const body = JSON.stringify({ modelId: "us.anthropic.claude-sonnet-5-5", prompt: "hello" });

async function run() {
  const events: ChatEvent[] = [];
  await runChat({ user, rawBody: body, requestId: "r", emit: (e) => events.push(e), remainingMs: () => 60_000 });
  return events;
}
const rows = () => [...store.values()].filter((i) => i.PK === "SESSION#s1");

beforeEach(() => {
  resetDb();
  order.length = 0;
  streamMock.streamModel.mockReset();
  store.set("USER#u1\u0000SESSION#s1", { PK: "USER#u1", SK: "SESSION#s1", sessionId: "s1", messageCount: 0 });
});

describe("runChat persistence", () => {
  it("saves the user message before calling the model", async () => {
    streamMock.streamModel.mockImplementation(async () => {
      expect(rows().map((r) => r.role)).toEqual(["user"]);
      return { text: "Hi", usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn", latencyMs: 5 };
    });
    const events = await run();
    expect(events.map((e) => e.type)).toEqual(["session", "notice", "done", "title"]);
    expect(rows().map((r) => r.role).sort()).toEqual(["assistant", "user"]);
  });

  it("on mid-stream failure keeps the partial answer with stop reason and error, then ends with one error", async () => {
    streamMock.streamModel.mockImplementation(async (_p: unknown, _c: unknown, emit: (e: ChatEvent) => void, _r: unknown, _s: unknown, progress: { text: string; stopReason?: string }) => {
      progress.text = "Partial ans";
      emit({ type: "delta", text: "Partial ans" });
      throw Object.assign(new Error("x"), { code: "BEDROCK_ERROR", name: "ChatFailure" });
    });
    const events = await run();
    expect(events.filter((e) => e.type === "error")).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("error");
    const assistant = rows().find((r) => r.role === "assistant");
    expect(assistant).toMatchObject({ content: "Partial ans", stopReason: "error", error: { code: "INTERNAL" } });
    expect(rows().some((r) => r.role === "user")).toBe(true);
    expect(store.has("USER#u1\u0000SESSION#s1")).toBe(true);
  });

  it("surfaces a failed save as a SAVE_FAILED notice instead of swallowing it, and still finishes with done", async () => {
    streamMock.streamModel.mockResolvedValue({ text: "Hi", usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn", latencyMs: 5 });
    const real = dbMockModule.putItem.getMockImplementation()!;
    dbMockModule.putItem.mockImplementation(async (item, opts) => {
      if (item.role === "assistant") throw new Error("ddb down");
      return real(item, opts);
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const events = await run();
    spy.mockRestore();
    dbMockModule.putItem.mockImplementation(real);
    expect(events.find((e) => e.type === "notice" && e.code === "SAVE_FAILED")).toBeTruthy();
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});

describe("runChat daily-limit reservation", () => {
  const counter = () => store.get("USAGE#2026-11-17\u0000COUNT#USER#u1")?.requests;

  it("a failed turn refunds the reserved request; a completed turn keeps it", async () => {
    store.set("USAGE#2026-11-17\u0000COUNT#USER#u1", { PK: "USAGE#2026-11-17", SK: "COUNT#USER#u1", requests: 3 });
    streamMock.streamModel.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await run();
    spy.mockRestore();
    expect(counter()).toBe(2);
    streamMock.streamModel.mockResolvedValue({ text: "Hi", usage: { inputTokens: 1, outputTokens: 1 }, stopReason: "end_turn", latencyMs: 5 });
    await run();
    expect(counter()).toBe(2);
  });
});

describe("failed new session cleanup", () => {
  it("a new compare session that failed before anything was saved is removed, like a chat", async () => {
    gatherFails.value = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const mode of ["chat", "compare"]) {
      store.set("USER#u1\u0000SESSION#s1", { PK: "USER#u1", SK: "SESSION#s1", sessionId: "s1" });
      const events: ChatEvent[] = [];
      await runChat({ user, rawBody: JSON.stringify({ modelId: "m", prompt: "hi", mode, compareModelIds: ["m", "n"] }), requestId: "r", emit: (e) => events.push(e), remainingMs: () => 1000 });
      expect(store.has("USER#u1\u0000SESSION#s1"), mode).toBe(false);
      expect(events.at(-1)?.type).toBe("error");
    }
    spy.mockRestore();
    gatherFails.value = false;
  });
});
