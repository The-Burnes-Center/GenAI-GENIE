import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, store } from "./dbmock.js";
import { objects, PDF, PNG, resetS3, s3Calls, s3Send } from "./s3mock.js";

vi.mock("../src/lib/db.js", async () => (await import("./dbmock.js")).dbMockModule);
vi.mock("../src/lib/aws.js", async () => (await import("./s3mock.js")).awsMockModule);
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: async () => "https://signed.example/put" }));
const kbMock = vi.hoisted(() => ({ startIngestion: vi.fn(async () => "job-1") }));
vi.mock("../src/lib/kb.js", async (orig) => ({ ...(await orig<typeof import("../src/lib/kb.js")>()), startIngestion: kbMock.startIngestion }));

const { buildRetrievalQuery } = await import("../src/chat/prepare.js");
const { resolveAttachments } = await import("../src/chat/attachments.js");
const { createLineWriter } = await import("../src/chat/line-writer.js");
const { handleRequest } = await import("../src/api/router.js");
const { uploadRoutes } = await import("../src/api/uploads.js");
const { workspaceRoutes } = await import("../src/api/workspaces.js");
const { adminReportRoutes } = await import("../src/api/admin-reports.js");
const { meRoutes } = await import("../src/api/me.js");
const { sessionRoutes } = await import("../src/api/sessions.js");
const { getSettings, migrateSettings } = await import("../src/lib/catalog.js");
const { resolveContent, CONTENT_UNAVAILABLE_NOTE } = await import("../src/lib/message-store.js");
const { forkSession } = await import("../src/lib/sessions.js");
const { TOMBSTONE_TTL_SECONDS, TOKEN_VALIDITY_MINUTES, MAX_REQUEST_ATTACHMENT_BYTES, UPLOAD_TTL_SECONDS } = await import("../src/lib/limits.js");
const { DEFAULT_SETTINGS, SETTINGS_HELP } = await import("../src/lib/defaults.js");
import { GPT, model, msg, SONNET } from "./fixtures.js";

const ALICE = { sub: "alice", email: "a@x.org", username: "alice", isAdmin: false, status: "active" as const };
const ADMIN = { ...ALICE, sub: "root", username: "root", isAdmin: true };

beforeEach(() => {
  resetDb();
  resetS3();
  kbMock.startIngestion.mockClear();
  process.env.TABLE_NAME = "t";
  process.env.UPLOADS_BUCKET = "bucket";
  process.env.AUTH_PARAMETER_NAME = "/x";
  process.env.KNOWLEDGE_BASE_ID = "kb";
  process.env.DATA_SOURCE_ID = "ds";
});

describe("retrieval query", () => {
  it("keeps head 600 + tail 900 of a long prompt, then the previous turn within a 1,500 cap", () => {
    const prompt = "H".repeat(600) + "M".repeat(5000) + "T".repeat(900);
    const q = buildRetrievalQuery(prompt, "previous question");
    expect(q.length).toBeLessThanOrEqual(1500);
    expect(q.startsWith("previous question\n")).toBe(true);
    expect(q.endsWith("T".repeat(500))).toBe(true); // the question at the end survives
    expect(q).toContain("H".repeat(300));
    expect(q).not.toContain("M");
    expect(buildRetrievalQuery(prompt, undefined)).toBe("H".repeat(600) + "T".repeat(900));
    expect(buildRetrievalQuery("short", "prev")).toBe("prev\nshort");
  });
  it("migrates an untouched old topK default (8) to 15 on read, but not custom values", async () => {
    expect(migrateSettings({ ...DEFAULT_SETTINGS, retrievalTopK: 8 }).retrievalTopK).toBe(15);
    expect(migrateSettings({ ...DEFAULT_SETTINGS, retrievalTopK: 12 }).retrievalTopK).toBe(12);
    store.set("CONFIG\u0000SETTINGS", { PK: "CONFIG", SK: "SETTINGS", ...DEFAULT_SETTINGS, retrievalTopK: 8 });
    expect((await getSettings()).retrievalTopK).toBe(15);
  });
});

describe("true cursor pagination for audit and feedback", () => {
  const call = async (path: string, query?: Record<string, string>) => {
    const res = await handleRequest(
      { rawPath: path, headers: { authorization: "x" }, queryStringParameters: query, requestContext: { http: { method: "GET" } } } as unknown as APIGatewayProxyEventV2,
      { routes: adminReportRoutes, allowedOrigin: "*", authenticate: async () => ADMIN, resolveStatus: async () => "active", confirmAdmin: async () => true },
    );
    return { status: res.statusCode, body: JSON.parse(res.body ?? "null") };
  };
  it("walks 2,500 audit rows page by page with no cap and no repeats", async () => {
    for (let i = 0; i < 2500; i++) store.set(`AUDIT\u0000${String(i).padStart(5, "0")}`, { PK: "AUDIT", SK: String(i).padStart(5, "0"), action: "x" });
    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      const r = await call("/api/admin/audit", cursor ? { cursor } : undefined);
      for (const i of r.body.items) seen.add(i.id);
      cursor = r.body.nextCursor ?? undefined;
      pages++;
    } while (cursor);
    expect(seen.size).toBe(2500);
    expect(pages).toBe(50);
  });
  it("feedback filters while paging, so filtered pages are full", async () => {
    for (let i = 0; i < 120; i++) store.set(`FEEDBACK\u0000${String(i).padStart(4, "0")}#m`, { PK: "FEEDBACK", SK: `${String(i).padStart(4, "0")}#m`, rating: i % 2 ? "down" : "up", modelId: "A" });
    const first = await call("/api/admin/feedback", { rating: "down" });
    expect(first.body.items).toHaveLength(50);
    const second = await call("/api/admin/feedback", { rating: "down", cursor: first.body.nextCursor });
    expect(second.body.items).toHaveLength(10);
    expect(second.body.nextCursor).toBeNull();
    expect((await call("/api/admin/audit", { cursor: Buffer.from(JSON.stringify({ k: { PK: "FEEDBACK", SK: "x" } })).toString("base64url") })).status).toBe(400);
  });
});

describe("response stream backpressure", () => {
  it("waits for drain when write() returns false, keeps order, and flush resolves after everything is written", async () => {
    const written: string[] = [];
    const stream = new PassThrough({ highWaterMark: 1 });
    const realWrite = stream.write.bind(stream);
    let drained = 0;
    stream.write = ((chunk: string) => (written.push(chunk), realWrite(chunk))) as typeof stream.write;
    stream.on("drain", () => drained++);
    const w = createLineWriter(stream);
    for (let i = 0; i < 5; i++) w.emit({ type: "delta", text: `t${i}` });
    const flushing = w.flush();
    expect(written.length).toBeLessThan(5); // blocked on the first drain
    stream.resume(); // reader catches up
    await flushing;
    expect(written.map((l) => JSON.parse(l).text)).toEqual(["t0", "t1", "t2", "t3", "t4"]);
    expect(drained).toBeGreaterThan(0);
  });
});

describe("attachments total payload budget (M4)", () => {
  const big = (n: number, type = "application/pdf") => ({ key: `attachments/alice/u/f${n}`, name: `f${n}.pdf`, contentType: type, size: 1 });
  it("sends documents over the 20 MB budget as text and drops images, newest history after current", async () => {
    const docs = [big(1), big(2), big(3)];
    const png = { key: "attachments/alice/u/p.png", name: "p.png", contentType: "image/png", size: 1 };
    const sized = (n: number) => { const b = new Uint8Array(n); b.set(PDF); return b; };
    const files: Record<string, { bytes: Uint8Array; contentType: string }> = {
      [docs[0]!.key]: { bytes: sized(4_400_000), contentType: "application/pdf" },
      [docs[1]!.key]: { bytes: sized(4_400_000), contentType: "application/pdf" },
      [docs[2]!.key]: { bytes: sized(4_400_000), contentType: "application/pdf" },
    };
    const images = Array.from({ length: 5 }, (_, i) => ({ key: `attachments/alice/u/i${i}.png`, name: `i${i}.png`, contentType: "image/png", size: 1 }));
    for (const im of images) { const b = new Uint8Array(3_700_000); b.set(PNG); files[im.key] = { bytes: b, contentType: "image/png" }; }
    void png;
    const store2 = {
      getObject: async (k: string) => files[k],
      getText: async () => undefined,
      putText: async () => undefined,
    };
    const extract = vi.spyOn(await import("../src/lib/extract.js"), "extractDocumentText").mockResolvedValue("as text");
    const history = [msg("user", "q", 1, { attachments: [docs[0]!, docs[1]!] })];
    const r = await resolveAttachments("alice", history, [docs[2]!, ...images], model(SONNET), store2);
    extract.mockRestore();
    const bytes = [...r.current, ...[...r.byMessage.values()].flat()].filter((a) => a.text === undefined).reduce((n, a) => n + a.bytes.length, 0);
    expect(bytes).toBeLessThanOrEqual(MAX_REQUEST_ATTACHMENT_BYTES);
    expect(r.current.find((a) => a.name === "f3.pdf")?.text).toBeUndefined(); // current turn is served first
    const limited = r.notices.filter((n) => n.code === "ATTACHMENTS_LIMITED").map((n) => n.message).join(" ");
    expect(limited).toContain("20 MB");
    expect(r.current.some((a) => a.name === "i4.png")).toBe(false); // an image beyond the budget is omitted
  });
  it("is a named 20,000,000-byte constant", () => expect(MAX_REQUEST_ATTACHMENT_BYTES).toBe(20_000_000));
});

describe("workspace registration sequencing (M3)", () => {
  const routes = [...uploadRoutes, ...workspaceRoutes];
  async function call(method: string, path: string, body?: unknown) {
    const res = await handleRequest(
      { rawPath: path, headers: { authorization: "x" }, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method } } } as unknown as APIGatewayProxyEventV2,
      { routes, allowedOrigin: "*", authenticate: async () => ALICE, resolveStatus: async () => "active", confirmAdmin: async () => false },
    );
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  }
  async function staged() {
    store.set("WORKSPACES\u0000WS#w1", { PK: "WORKSPACES", SK: "WS#w1", workspaceId: "w1", name: "W", visibility: "personal", ownerSub: "alice", ownerEmail: "", createdAt: "t", docCount: 0 });
    const up = await call("POST", "/api/uploads", { fileName: "a.pdf", contentType: "application/pdf", size: 100, purpose: "workspace", workspaceId: "w1" });
    objects.set(up.body.key, { bytes: PDF, contentType: "application/pdf" });
    return up.body.key as string;
  }
  const docs = () => [...store.values()].filter((i) => i.PK === "WS#w1");

  it("pending upload records expire after a day", async () => {
    await staged();
    const pending = [...store.values()].find((i) => i.PK === "UPLOAD#alice");
    expect(Number(pending?.expiresAt) - Date.now() / 1000).toBeGreaterThan(UPLOAD_TTL_SECONDS - 60);
  });

  it("the copy is conditional on the ETag seen at HEAD, and the pending claim is consumed first", async () => {
    const key = await staged();
    const res = await call("POST", "/api/workspaces/w1/documents", { key, name: "a.pdf" });
    expect(res.status).toBe(201);
    expect(res.body.document.status).toBe("indexing");
    const copy = s3Calls.find((c) => c.name === "CopyObjectCommand");
    expect(copy?.input.CopySourceIfMatch).toBe('"etag"');
    expect(s3Calls.find((c) => c.name === "GetObjectCommand")?.input.IfMatch).toBe('"etag"');
    // second registration of the same staging key is refused
    expect((await call("POST", "/api/workspaces/w1/documents", { key, name: "a.pdf" })).status).toBe(400);
    expect(docs()).toHaveLength(1);
  });

  it("a failed copy marks the document failed and removes anything copied; nothing is left under workspaces/", async () => {
    const key = await staged();
    const base = s3Send.getMockImplementation()!;
    s3Send.mockImplementation(async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (cmd.constructor.name === "CopyObjectCommand") throw Object.assign(new Error("PreconditionFailed"), { name: "PreconditionFailed" });
      return base(cmd as never);
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call("POST", "/api/workspaces/w1/documents", { key, name: "a.pdf" });
    spy.mockRestore();
    s3Send.mockImplementation(base);
    expect(res.status).toBe(400);
    expect(docs()[0]).toMatchObject({ status: "failed" });
    const deleted = s3Calls.filter((c) => c.name === "DeleteObjectsCommand").flatMap((c) => (c.input.Delete as { Objects: { Key: string }[] }).Objects.map((o) => o.Key));
    expect(deleted.some((k) => k.startsWith("workspaces/w1/"))).toBe(true);
    expect(s3Calls.some((c) => c.name === "PutObjectCommand")).toBe(false); // sidecar never written
    expect(s3Calls.some((c) => c.name === "DeleteObjectCommand")).toBe(false); // staging kept
    expect(kbMock.startIngestion).not.toHaveBeenCalled();
  });
});

describe("failed long-message fetch (M6)", () => {
  const long = { ...msg("assistant", "preview", 1), contentKey: "messages/s1/m1.txt" };
  it("display path degrades per message; model path still fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const out = await resolveContent([long, msg("user", "ok", 2)], { lenient: true });
    expect(out[0]).toMatchObject({ contentUnavailable: true, content: CONTENT_UNAVAILABLE_NOTE });
    expect(out[0]).not.toHaveProperty("contentKey");
    expect(out[1]?.content).toBe("ok");
    await expect(resolveContent([long])).rejects.toMatchObject({ status: 500 });
    spy.mockRestore();
  });
  it("GET /api/sessions/{id} returns 200 with the degraded message", async () => {
    store.set("USER#alice\u0000SESSION#s1", { PK: "USER#alice", SK: "SESSION#s1", sessionId: "s1", mode: "chat" });
    store.set("SESSION#s1\u0000MSG#1#m1", { PK: "SESSION#s1", SK: "MSG#1#m1", ...long, sessionId: "s1" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await handleRequest(
      { rawPath: "/api/sessions/s1", headers: { authorization: "x" }, requestContext: { http: { method: "GET" } } } as unknown as APIGatewayProxyEventV2,
      { routes: sessionRoutes, allowedOrigin: "*", authenticate: async () => ALICE, resolveStatus: async () => "active", confirmAdmin: async () => false },
    );
    spy.mockRestore();
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "").messages[0].contentUnavailable).toBe(true);
  });
});

describe("admin check when Cognito is unavailable", () => {
  const run = async (method: string, path: string) => {
    const res = await handleRequest(
      { rawPath: path, headers: { authorization: "x" }, requestContext: { http: { method } } } as unknown as APIGatewayProxyEventV2,
      { routes: adminReportRoutes, allowedOrigin: "*", authenticate: async () => ADMIN, resolveStatus: async () => "active", confirmAdmin: async () => "unknown" },
    );
    return { status: res.statusCode, body: JSON.parse(res.body ?? "null") };
  };
  it("reads fall back to the token claim; mutations get 503 with no admin.denied audit row", async () => {
    expect((await run("GET", "/api/admin/audit")).status).toBe(200);
    const patch = await run("PATCH", "/api/admin/feedback/x");
    expect(patch.status).toBe(503);
    expect(patch.body.error.message).toMatch(/Couldn't confirm administrator access/);
    expect([...store.values()].some((i) => i.action === "admin.denied")).toBe(false);
  });
});

describe("public config, fork rollback and constants", () => {
  it("public-config does not write defaults to the table", async () => {
    const res = await handleRequest(
      { rawPath: "/api/public-config", headers: {}, requestContext: { http: { method: "GET" } } } as unknown as APIGatewayProxyEventV2,
      { routes: meRoutes, allowedOrigin: "*" },
    );
    expect(res.statusCode).toBe(200);
    expect(store.size).toBe(0);
  });

  it("a failed fork leaves no session, messages or copied objects behind", async () => {
    const att = { key: "attachments/alice/u1/a.pdf", name: "a.pdf", contentType: "application/pdf", size: 1 };
    objects.set(att.key, { bytes: PDF });
    const source = { sessionId: "c1", title: "t", mode: "compare", modelId: "A", modelIds: ["A", "B"], createdAt: "", updatedAt: "", messageCount: 2 } as never;
    const messages = [msg("user", "q", 1, { modelId: "A", turn: 0, attachments: [att] }), msg("assistant", "a", 2, { modelId: "A", turn: 0 })];
    const { dbMockModule } = await import("./dbmock.js");
    const real = dbMockModule.putItem.getMockImplementation()!;
    dbMockModule.putItem.mockImplementation(async (item, opts) => {
      if (item.role === "assistant") throw new Error("ddb down");
      return real(item, opts);
    });
    await expect(forkSession("alice", source, messages, "A")).rejects.toThrow("ddb down");
    dbMockModule.putItem.mockImplementation(real);
    expect([...store.values()].filter((i) => String(i.PK).startsWith("SESSION#") || String(i.SK).startsWith("SESSION#"))).toHaveLength(0);
    const deleted = s3Calls.filter((c) => c.name === "DeleteObjectsCommand").flatMap((c) => (c.input.Delete as { Objects: { Key: string }[] }).Objects.map((o) => o.Key));
    expect(deleted.some((k) => k.startsWith("attachments/alice/") && k !== att.key)).toBe(true);
    expect(deleted).not.toContain(att.key); // the source's own object is untouched
  });

  it("tombstone TTL is tied to token validity and the timezone help warns about mid-day changes", () => {
    expect(TOMBSTONE_TTL_SECONDS).toBeGreaterThanOrEqual(TOKEN_VALIDITY_MINUTES * 60 * 2);
    expect(SETTINGS_HELP.timezone).toMatch(/mid-day/);
  });

  it("GPT-style models still reject nothing here (sanity for fixtures)", () => expect(model(GPT).capabilities.documents).toBe(false));
});
