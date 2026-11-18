import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbMockModule, resetDb, store } from "./dbmock.js";

vi.mock("../src/lib/db.js", async () => (await import("./dbmock.js")).dbMockModule);
const cognitoMock = vi.hoisted(() => ({
  setEnabled: vi.fn(async () => ({})),
  setAdmin: vi.fn(async () => undefined),
  deleteUser: vi.fn(async () => ({})),
  subFor: vi.fn(async (u: string) => `sub-${u}`),
  signOutUser: vi.fn(async () => ({})),
  groupsFor: vi.fn(async () => []),
  resetPassword: vi.fn(),
  inviteUser: vi.fn(),
  listUsersPage: vi.fn(),
  cognitoCall: async <T>(fn: () => Promise<T>) => fn(),
}));
vi.mock("../src/lib/cognito-users.js", () => cognitoMock);

const { handleRequest } = await import("../src/api/router.js");
const { sessionRoutes } = await import("../src/api/sessions.js");
const { adminUserRoutes } = await import("../src/api/admin-users.js");
const { adminReportRoutes, filterFeedback } = await import("../src/api/admin-reports.js");
const { meRoutes } = await import("../src/api/me.js");
const { openSession } = await import("../src/chat/prepare.js");
const { persistFailedAnswer, persistUserMessage, collectExtras } = await import("../src/chat/run.js");
const { clearProfileCache } = await import("../src/lib/profile.js");
const { discardFailedTurn, findRetryPair } = await import("../src/lib/sessions.js");
const { addPending } = await import("../src/lib/pending.js");
const { DEFAULT_MODELS, DEFAULT_SETTINGS } = await import("../src/lib/defaults.js");
import { msg, SONNET } from "./fixtures.js";

const USERS = {
  alice: { sub: "alice", email: "alice@x.org", username: "alice", isAdmin: false, status: "active" as const },
  bob: { sub: "bob", email: "bob@x.org", username: "bob", isAdmin: false, status: "active" as const },
  admin: { sub: "root", email: "root@x.org", username: "root", isAdmin: true, status: "active" as const },
};
type Who = keyof typeof USERS;

const routes = [...sessionRoutes, ...adminUserRoutes, ...adminReportRoutes, ...meRoutes];

async function call(who: Who, method: string, path: string, body?: unknown, query?: Record<string, string>) {
  const event = {
    rawPath: path,
    headers: { authorization: `Bearer ${who}` },
    queryStringParameters: query,
    body: body === undefined ? undefined : JSON.stringify(body),
    requestContext: { http: { method } },
  } as unknown as APIGatewayProxyEventV2;
  const res = await handleRequest(event, {
    routes,
    allowedOrigin: "*",
    authenticate: async (h) => USERS[(h.authorization as string).slice(7) as Who],
    resolveStatus: async () => "active",
    confirmAdmin: async () => true,
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

const put = (item: Record<string, unknown>) => store.set(`${item.PK}\u0000${item.SK}`, item);
const putMsg = (sessionId: string, m: ReturnType<typeof msg>) =>
  put({ PK: `SESSION#${sessionId}`, SK: `MSG#${m.createdAt}#${m.messageId}`, ...m, sessionId });

function seedCompare() {
  put({
    PK: "USER#alice", SK: "SESSION#c1", sessionId: "c1", title: "Cmp", mode: "compare", modelId: "A", modelIds: ["A", "B"],
    workspaceId: "w1", createdAt: "t", updatedAt: "t", messageCount: 6,
  });
  putMsg("c1", msg("user", "q1", 1, { modelId: "A", turn: 0 }));
  putMsg("c1", msg("assistant", "a1-A", 2, { modelId: "A", turn: 0 }));
  putMsg("c1", msg("user", "q1", 3, { modelId: "B", turn: 0 }));
  putMsg("c1", msg("assistant", "b1-B", 4, { modelId: "B", turn: 0 }));
  putMsg("c1", msg("user", "q2", 5, { modelId: "A", turn: 1 }));
  putMsg("c1", msg("assistant", "", 6, { modelId: "A", turn: 1, error: { code: "BEDROCK_ERROR", message: "x" } }));
}

beforeEach(() => {
  resetDb();
  clearProfileCache();
  vi.clearAllMocks();
});

describe("fork", () => {
  it("copies only that model's successful turns into a new chat session", async () => {
    seedCompare();
    const res = await call("alice", "POST", "/api/sessions/c1/fork", { modelId: "A" });
    expect(res.status).toBe(201);
    const id = res.body.sessionId as string;
    const session = store.get(`USER#alice\u0000SESSION#${id}`);
    expect(session).toMatchObject({ mode: "chat", modelId: "A", workspaceId: "w1", messageCount: 2 });
    const copied = [...store.values()].filter((i) => i.PK === `SESSION#${id}`).sort((a, b) => String(a.SK).localeCompare(String(b.SK)));
    expect(copied.map((m) => m.content)).toEqual(["q1", "a1-A"]);
    expect(copied.every((m) => m.sessionId === id)).toBe(true);
    // the source is untouched
    expect([...store.values()].filter((i) => i.PK === "SESSION#c1")).toHaveLength(6);
  });

  it("404s for another user's session and creates nothing", async () => {
    seedCompare();
    const before = store.size;
    expect((await call("bob", "POST", "/api/sessions/c1/fork", { modelId: "A" })).status).toBe(404);
    expect(store.size).toBe(before);
  });

  it("rejects non-compare sessions and models outside the comparison", async () => {
    seedCompare();
    put({ PK: "USER#alice", SK: "SESSION#p1", sessionId: "p1", mode: "chat", modelId: "A", title: "x", createdAt: "t", updatedAt: "t", messageCount: 0 });
    expect((await call("alice", "POST", "/api/sessions/p1/fork", { modelId: "A" })).status).toBe(400);
    expect((await call("alice", "POST", "/api/sessions/c1/fork", { modelId: "Z" })).status).toBe(400);
    expect((await call("alice", "POST", "/api/sessions/c1/fork", {})).status).toBe(400);
  });
});

describe("retry of a failed turn", () => {
  const baseSession = { sessionId: "c1", mode: "chat", modelId: "A", title: "t", createdAt: "", updatedAt: "", messageCount: 2 };
  const session = baseSession as never;

  it("findRetryPair pairs a failed reply, or the latest reply, with its prompt only", () => {
    const messages = [
      msg("user", "q0", 1, { modelId: "A", turn: 0 }), msg("assistant", "ok", 2, { modelId: "A", turn: 0 }),
      msg("user", "q1", 3, { modelId: "A", turn: 1 }), msg("assistant", "", 4, { modelId: "A", turn: 1, error: { code: "E", message: "m" } }),
    ];
    const pair = findRetryPair(session, messages, "m4");
    expect(pair?.assistant.messageId).toBe("m4");
    expect(pair?.user?.messageId).toBe("m3");
    expect(findRetryPair(session, messages, "m2")).toBeUndefined(); // an older, successful reply
    expect(findRetryPair(session, messages, "m3")).toBeUndefined(); // a user message
    expect(findRetryPair(session, messages, "nope")).toBeUndefined();

    // Once the latest reply succeeded, it can be regenerated and the older one cannot.
    const answered = [...messages.slice(0, 3), msg("assistant", "fine", 4, { modelId: "A", turn: 1 })];
    expect(findRetryPair(session, answered, "m4")?.user?.messageId).toBe("m3");
    expect(findRetryPair(session, answered, "m2")).toBeUndefined();
  });

  it("in a compare session, the latest reply of each model can be retried", () => {
    const compare = { ...baseSession, mode: "compare" } as never;
    const messages = [
      msg("user", "q", 1, { modelId: "A", turn: 0 }), msg("assistant", "a", 2, { modelId: "A", turn: 0 }),
      msg("user", "q", 3, { modelId: "B", turn: 0 }), msg("assistant", "b", 4, { modelId: "B", turn: 0 }),
    ];
    expect(findRetryPair(compare, messages, "m2")?.user?.messageId).toBe("m1");
    expect(findRetryPair(compare, messages, "m4")?.user?.messageId).toBe("m3");
  });

  it("deletes the failed pair and nothing else", async () => {
    seedCompare();
    put({ PK: "USER#alice", SK: "SESSION#c1", sessionId: "c1", mode: "compare", messageCount: 6 });
    const all = [...store.values()].filter((i) => i.PK === "SESSION#c1").map(({ PK: _p, SK: _s, ...m }) => m) as unknown as ReturnType<typeof msg>[];
    const removed = await discardFailedTurn("alice", session, all, "m6");
    expect(removed.sort()).toEqual(["m5", "m6"]);
    expect([...store.values()].filter((i) => i.PK === "SESSION#c1")).toHaveLength(4);
    expect(store.get("USER#alice\u0000SESSION#c1")?.messageCount).toBe(4);
  });

  it("regenerates the latest successful reply, deleting its pair", async () => {
    seedCompare();
    put({ PK: "USER#alice", SK: "SESSION#c1", sessionId: "c1", mode: "compare", messageCount: 6 });
    const all = [...store.values()].filter((i) => i.PK === "SESSION#c1").map(({ PK: _p, SK: _s, ...m }) => m) as unknown as ReturnType<typeof msg>[];
    // m4 is model B's only (and latest) reply; its failed sibling m6 belongs to A.
    const removed = await discardFailedTurn("alice", { ...baseSession, mode: "compare" } as never, all, "m4");
    expect(removed.sort()).toEqual(["m3", "m4"]);
    expect([...store.values()].filter((i) => i.PK === "SESSION#c1")).toHaveLength(4);
  });

  it("refuses to discard an older successful reply", async () => {
    seedCompare();
    const all = [...store.values()].filter((i) => i.PK === "SESSION#c1") as unknown as ReturnType<typeof msg>[];
    await expect(discardFailedTurn("alice", session, all, "m2")).rejects.toMatchObject({ status: 400 });
    expect([...store.values()].filter((i) => i.PK === "SESSION#c1")).toHaveLength(6);
  });

  const checked = { model: DEFAULT_MODELS[0]!, settings: DEFAULT_SETTINGS, plan: { kinds: [], asText: [] }, reservation: { pk: 'USAGE#d', sub: 'x' } };
  const req = (over: object) => ({ modelId: SONNET, prompt: "again", attachments: [], mode: "chat" as const, ...over });

  it("openSession: another user cannot retry (or even open) someone else's session", async () => {
    seedCompare();
    await expect(openSession(USERS.bob, req({ sessionId: "c1", mode: "compare", retryOfMessageId: "m6" }), checked)).rejects.toMatchObject({ status: 404 });
    expect([...store.values()].filter((i) => i.PK === "SESSION#c1")).toHaveLength(6);
  });

  it("openSession: retry needs a sessionId and a real failed message of that session", async () => {
    seedCompare();
    await expect(openSession(USERS.alice, req({ retryOfMessageId: "m6" }), checked)).rejects.toMatchObject({ status: 400 });
    await expect(
      openSession(USERS.alice, req({ sessionId: "c1", mode: "compare", retryOfMessageId: "m2" }), checked),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("openSession: owner retry removes the failed pair from the loaded history", async () => {
    seedCompare();
    const p = await openSession(USERS.alice, req({ modelId: "A", sessionId: "c1", mode: "compare", retryOfMessageId: "m6", turn: 1 }), checked);
    expect(p.allMessages.map((m) => m.messageId)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(p.history.map((m) => m.messageId)).toEqual(["m1", "m2"]);
    expect(p.turn).toBe(1);
  });
});

describe("failed turns and stream extras", () => {
  it("collectExtras gathers reasoning, notices and thinking time", () => {
    const x = { reasoning: "", notices: [] as { code: string; message: string }[] } as import("../src/chat/run.js").StreamExtras;
    collectExtras(x, { type: "reasoning", text: "a" }, 1000, 1500);
    collectExtras(x, { type: "reasoning", text: "b" }, 1000, 1600);
    collectExtras(x, { type: "notice", code: "HISTORY_TRIMMED", message: "m" }, 1000, 1700);
    collectExtras(x, { type: "delta", text: "hi" }, 1000, 4000);
    collectExtras(x, { type: "delta", text: "again" }, 1000, 9000);
    expect(x).toEqual({ reasoning: "ab", notices: [{ code: "HISTORY_TRIMMED", message: "m" }], thinkingMs: 3000 });
  });

  it("does not report thinking time when no reasoning streamed", () => {
    const x = { reasoning: "", notices: [] } as import("../src/chat/run.js").StreamExtras;
    collectExtras(x, { type: "delta", text: "hi" }, 0, 500);
    expect(x.thinkingMs).toBeUndefined();
  });

  it("stores the prompt first and, on failure, an assistant message with the partial text, stop reason and error", async () => {
    const p = {
      req: { modelId: "A", prompt: "hello", attachments: [], mode: "chat" },
      session: { sessionId: "s9" }, turn: 3,
    } as never;
    put({ PK: "USER#alice", SK: "SESSION#s9", sessionId: "s9", messageCount: 0 });
    await persistUserMessage(USERS.alice, p, "2026-11-17T10:00:00.000Z");
    expect([...store.values()].filter((i) => i.PK === "SESSION#s9")).toHaveLength(1);
    await persistFailedAnswer(USERS.alice, p, "asst-1", { code: "BEDROCK_ERROR", message: "busy" }, { text: "Par", stopReason: "max_tokens" }, { reasoning: "partial", notices: [] });
    const rows = [...store.values()].filter((i) => i.PK === "SESSION#s9");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.role === "assistant")).toMatchObject({
      messageId: "asst-1", content: "Par", stopReason: "max_tokens", error: { code: "BEDROCK_ERROR", message: "busy" }, reasoning: "partial", turn: 3, modelId: "A",
    });
    expect(rows.find((r) => r.role === "user")).toMatchObject({ content: "hello", turn: 3 });
    expect(store.get("USER#alice\u0000SESSION#s9")?.messageCount).toBe(2);
  });
});

describe("suspend, activate, decline", () => {
  it("suspend sets the profile status and disables the Cognito user", async () => {
    const res = await call("admin", "PATCH", "/api/admin/users/carol", { status: "suspended" });
    expect(res.status).toBe(200);
    expect(cognitoMock.setEnabled).toHaveBeenCalledWith("carol", false);
    expect(cognitoMock.signOutUser).toHaveBeenCalledWith("carol"); // refresh tokens revoked too
    expect(store.get("USER#sub-carol\u0000PROFILE")).toMatchObject({ status: "suspended" });
    expect([...store.values()].some((i) => i.PK === "AUDIT" && i.action === "user.update")).toBe(true);
  });

  it("activate re-enables the user, sets active and clears the approval queue entry", async () => {
    await addPending("sub-carol", "carol@x.org");
    put({ PK: "USER#sub-carol", SK: "PROFILE", status: "pending" });
    const res = await call("admin", "PATCH", "/api/admin/users/carol", { status: "active" });
    expect(res.status).toBe(200);
    expect(cognitoMock.setEnabled).toHaveBeenCalledWith("carol", true);
    expect(cognitoMock.signOutUser).not.toHaveBeenCalled();
    expect(store.get("USER#sub-carol\u0000PROFILE")).toMatchObject({ status: "active" });
    expect(store.has("PENDING\u0000sub-carol")).toBe(false);
  });

  it("an admin cannot suspend or demote themselves, and `enabled` is no longer accepted", async () => {
    expect((await call("admin", "PATCH", "/api/admin/users/root", { status: "suspended" })).status).toBe(403);
    expect((await call("admin", "PATCH", "/api/admin/users/root", { role: "user" })).status).toBe(403);
    expect((await call("admin", "PATCH", "/api/admin/users/carol", { enabled: false })).status).toBe(400);
    expect(cognitoMock.setEnabled).not.toHaveBeenCalled();
  });

  it("non-admins get 403 on the user routes", async () => {
    expect((await call("alice", "PATCH", "/api/admin/users/carol", { status: "suspended" })).status).toBe(403);
    expect(cognitoMock.setEnabled).not.toHaveBeenCalled();
  });

  it("deleting a pending sign-up removes the Cognito user and queue entry and leaves a deleted tombstone with a TTL", async () => {
    await addPending("sub-dan", "dan@x.org");
    put({ PK: "USER#sub-dan", SK: "PROFILE", status: "pending" });
    expect((await call("admin", "DELETE", "/api/admin/users/dan")).status).toBe(204);
    expect(cognitoMock.signOutUser).toHaveBeenCalledWith("dan");
    expect(cognitoMock.deleteUser).toHaveBeenCalledWith("dan");
    const tomb = store.get("USER#sub-dan\u0000PROFILE");
    expect(tomb).toMatchObject({ status: "deleted" });
    const ttl = Number(tomb?.expiresAt) - Date.now() / 1000;
    expect(ttl).toBeGreaterThan(86_400 - 60);
    expect(ttl).toBeLessThanOrEqual(86_400);
    expect(store.has("PENDING\u0000sub-dan")).toBe(false);
  });

  it("an admin cannot delete themselves", async () => {
    expect((await call("admin", "DELETE", "/api/admin/users/root")).status).toBe(403);
    expect(cognitoMock.deleteUser).not.toHaveBeenCalled();
  });
});

describe("pendingCount", () => {
  it("is included for admins only, on /api/me and bootstrap.me", async () => {
    await addPending("s1", "a@x.org");
    await addPending("s2", "b@x.org");
    expect((await call("admin", "GET", "/api/me")).body).toMatchObject({ isAdmin: true, pendingCount: 2 });
    expect((await call("alice", "GET", "/api/me")).body).not.toHaveProperty("pendingCount");
    const boot = await call("admin", "GET", "/api/bootstrap");
    expect(boot.body.me.pendingCount).toBe(2);
    expect(boot.body.usage).toMatchObject({ used: 0, limit: 100 });
    expect(typeof boot.body.usage.resetsAt).toBe("string");
    expect((await call("alice", "GET", "/api/bootstrap")).body.me).not.toHaveProperty("pendingCount");
  });
});

describe("feedback triage", () => {
  const fb = (at: string, over: Record<string, unknown>) =>
    put({ PK: "FEEDBACK", SK: `${at}#m`, rating: "down", modelId: "A", ...over });

  it("filters by rating, model and reviewed, newest first, with ids and cursor", async () => {
    fb("2026-11-17T01", { reviewed: false });
    fb("2026-11-17T02", { reviewed: true });
    fb("2026-11-17T03", { rating: "up", modelId: "B" });
    const all = await call("admin", "GET", "/api/admin/feedback");
    expect(all.body.items.map((i: { id: string }) => i.id)).toEqual(["2026-11-17T03#m", "2026-11-17T02#m", "2026-11-17T01#m"]);
    expect(all.body.items[0].reviewed).toBe(false); // missing flag reads as false
    expect((await call("admin", "GET", "/api/admin/feedback", undefined, { rating: "down", reviewed: "false" })).body.items).toHaveLength(1);
    expect((await call("admin", "GET", "/api/admin/feedback", undefined, { modelId: "B" })).body.items).toHaveLength(1);
    expect((await call("admin", "GET", "/api/admin/feedback", undefined, { reviewed: "maybe" })).status).toBe(400);
    expect((await call("admin", "GET", "/api/admin/feedback", undefined, { cursor: "!!" })).status).toBe(400);
  });

  it("pages with a cursor", async () => {
    for (let i = 0; i < 55; i++) fb(`2026-11-17T${String(i).padStart(2, "0")}`, {});
    const first = await call("admin", "GET", "/api/admin/feedback");
    expect(first.body.items).toHaveLength(50);
    const second = await call("admin", "GET", "/api/admin/feedback", undefined, { cursor: first.body.nextCursor });
    expect(second.body.items).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
  });

  it("PATCH marks reviewed, audits it, and 404s unknown ids; non-admins get 403", async () => {
    fb("2026-11-17T01", {});
    const id = encodeURIComponent("2026-11-17T01#m");
    expect((await call("admin", "PATCH", `/api/admin/feedback/${id}`, { reviewed: true })).status).toBe(200);
    expect(store.get("FEEDBACK\u00002026-11-17T01#m")?.reviewed).toBe(true);
    expect((await call("admin", "PATCH", "/api/admin/feedback/nope", { reviewed: true })).status).toBe(404);
    expect((await call("admin", "PATCH", `/api/admin/feedback/${id}`, {})).status).toBe(400);
    expect((await call("alice", "PATCH", `/api/admin/feedback/${id}`, { reviewed: false })).status).toBe(403);
  });

  it("filterFeedback treats undefined filters as wildcards", () => {
    const items = [{ SK: "a", rating: "up", modelId: "A" }, { SK: "b", rating: "down", modelId: "A", reviewed: true }];
    expect(filterFeedback(items, {})).toHaveLength(2);
    expect(filterFeedback(items, { reviewed: false }).map((i) => i.SK)).toEqual(["a"]);
  });
});

void dbMockModule;
