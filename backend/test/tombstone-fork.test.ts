import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, store } from "./dbmock.js";
import { objects, resetS3, s3Calls } from "./s3mock.js";

vi.mock("../src/lib/db.js", async () => (await import("./dbmock.js")).dbMockModule);
const cognitoSend = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/aws.js", async () => {
  const m = await import("./s3mock.js");
  return { ...m.awsMockModule, cognito: () => ({ send: cognitoSend }) };
});
vi.mock("../src/lib/config.js", async (orig) => ({
  ...(await orig<typeof import("../src/lib/config.js")>()),
  getAuthParams: async () => ({ userPoolId: "pool", userPoolClientId: "client" }),
}));

const { assertStatusAllowed, clearProfileCache, resolveStatus } = await import("../src/lib/profile.js");
const { listUsersPage } = await import("../src/lib/cognito-users.js");
const { handleRequest } = await import("../src/api/router.js");
const { sessionRoutes } = await import("../src/api/sessions.js");
import { msg } from "./fixtures.js";

const ALICE = { sub: "alice", email: "a@x.org", username: "alice", isAdmin: false, status: "active" as const };

beforeEach(() => {
  resetDb();
  resetS3();
  clearProfileCache();
  process.env.TABLE_NAME = "t";
  process.env.UPLOADS_BUCKET = "bucket";
  process.env.AUTH_PARAMETER_NAME = "/x";
  process.env.KNOWLEDGE_BASE_ID = "kb";
  process.env.DATA_SOURCE_ID = "ds";
});

describe("deleted-user tombstone", () => {
  it("blocks a still-valid token with 403 and a clear message, even when approval is off", async () => {
    store.set("CONFIG\u0000SETTINGS", { PK: "CONFIG", SK: "SETTINGS", requireApproval: false });
    store.set("USER#alice\u0000PROFILE", { status: "deleted", expiresAt: 1 });
    await expect(resolveStatus(ALICE)).rejects.toMatchObject({ status: 403, code: "SUSPENDED", message: "This account no longer exists." });
    expect(() => assertStatusAllowed("deleted")).toThrow(/no longer exists/);
  });

  it("is hidden from the admin user listing", async () => {
    const user = (name: string, sub: string) => ({ Username: name, Attributes: [{ Name: "sub", Value: sub }, { Name: "email", Value: `${name}@x.org` }] });
    cognitoSend.mockImplementation(async (cmd: { constructor: { name: string } }) =>
      cmd.constructor.name === "ListUsersCommand" ? { Users: [user("kept", "s1"), user("gone", "s2")] } : { Users: [] },
    );
    store.set("USER#s1\u0000PROFILE", { status: "active" });
    store.set("USER#s2\u0000PROFILE", { status: "deleted" });
    const page = await listUsersPage(undefined);
    expect(page.items.map((u) => u.username)).toEqual(["kept"]);
  });
});

describe("fork copies attachments", () => {
  const A1 = { key: "attachments/alice/u1/report.pdf", name: "report.pdf", contentType: "application/pdf", size: 5 };
  const A2 = { key: "attachments/alice/u2/pic.png", name: "pic.png", contentType: "image/png", size: 5 };
  const FOREIGN = { key: "attachments/bob/u3/secret.pdf", name: "secret.pdf", contentType: "application/pdf", size: 5 };

  const call = (path: string, body: unknown, user = ALICE) =>
    handleRequest(
      { rawPath: path, headers: { authorization: "x" }, body: JSON.stringify(body), requestContext: { http: { method: "POST" } } } as unknown as APIGatewayProxyEventV2,
      { routes: sessionRoutes, allowedOrigin: "*", authenticate: async () => user, resolveStatus: async () => "active", confirmAdmin: async () => false },
    );

  function seed() {
    store.set("USER#alice\u0000SESSION#c1", { PK: "USER#alice", SK: "SESSION#c1", sessionId: "c1", title: "Cmp", mode: "compare", modelId: "A", modelIds: ["A", "B"], createdAt: "t", updatedAt: "t", messageCount: 4 });
    const put = (m: ReturnType<typeof msg>) => store.set(`SESSION#c1\u0000MSG#${m.createdAt}#${m.messageId}`, { PK: "SESSION#c1", SK: `MSG#${m.createdAt}#${m.messageId}`, ...m, sessionId: "c1" });
    put(msg("user", "q1", 1, { modelId: "A", turn: 0, attachments: [A1, A2] }));
    put(msg("assistant", "a1", 2, { modelId: "A", turn: 0 }));
    put(msg("user", "q2", 3, { modelId: "A", turn: 1, attachments: [A1, FOREIGN] }));
    put(msg("assistant", "a2", 4, { modelId: "A", turn: 1 }));
    objects.set(A1.key, { bytes: new Uint8Array([1]) });
    objects.set(`${A1.key}.txt`, { bytes: new Uint8Array([2]) });
    // A2 has no cached extraction; FOREIGN belongs to someone else
  }

  it("copies each referenced object (and cached text) once to a new key under the caller's prefix and rewrites the messages", async () => {
    seed();
    const res = await call("/api/sessions/c1/fork", { modelId: "A" });
    expect(res.statusCode).toBe(201);
    const id = JSON.parse(res.body ?? "").sessionId as string;
    const forked = [...store.values()].filter((i) => i.PK === `SESSION#${id}`).sort((a, b) => String(a.SK).localeCompare(String(b.SK)));
    const keys = forked.flatMap((m) => ((m.attachments ?? []) as { key: string }[]).map((a) => a.key));
    expect(keys).toHaveLength(4);
    const a1 = (forked[0]?.attachments as { key: string }[])[0]!.key;
    const a2 = (forked[0]?.attachments as { key: string }[])[1]!.key;
    for (const k of [a1, a2]) {
      expect(k).toMatch(/^attachments\/alice\/[0-9a-f-]{36}\/(report\.pdf|pic\.png)$/);
      expect([A1.key, A2.key]).not.toContain(k);
    }
    // the same source attachment maps to the same copy across messages
    expect((forked[2]?.attachments as { key: string }[])[0]!.key).toBe(a1);
    // someone else's object is never copied and keeps its original reference
    expect((forked[2]?.attachments as { key: string }[])[1]!.key).toBe(FOREIGN.key);
    const copies = s3Calls.filter((c) => c.name === "CopyObjectCommand").map((c) => [c.input.CopySource, c.input.Key]);
    expect(copies).toContainEqual([`bucket/${A1.key}`, a1]);
    expect(copies).toContainEqual([`bucket/${A1.key}.txt`, `${a1}.txt`]);
    expect(copies.filter(([from]) => from === `bucket/${A1.key}`)).toHaveLength(1);
    expect(copies.some(([from]) => String(from).includes("bob"))).toBe(false);
  });

  it("deleting the source session leaves the fork's attachment objects intact", async () => {
    seed();
    const id = JSON.parse((await call("/api/sessions/c1/fork", { modelId: "A" })).body ?? "").sessionId as string;
    const forked = [...store.values()].filter((i) => i.PK === `SESSION#${id}`);
    const forkKeys = new Set(forked.flatMap((m) => ((m.attachments ?? []) as { key: string }[]).map((a) => a.key)).filter((k) => k !== FOREIGN.key));
    const { attachmentKeys } = await import("../src/lib/sessions.js");
    const sourceRows = [...store.values()].filter((i) => i.PK === "SESSION#c1") as { attachments?: { key: string }[] }[];
    const doomed = new Set(attachmentKeys(sourceRows));
    for (const k of forkKeys) expect(doomed.has(k), k).toBe(false);
  });

  it("an expired original is left referenced rather than failing the fork", async () => {
    seed();
    objects.delete(A1.key);
    const res = await call("/api/sessions/c1/fork", { modelId: "A" });
    expect(res.statusCode).toBe(201);
  });
});
