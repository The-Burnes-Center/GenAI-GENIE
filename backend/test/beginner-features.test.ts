import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemContentBlock } from "@aws-sdk/client-bedrock-runtime";
import { resetDb, store } from "./dbmock.js";
import { emptyContext, model, prepared, SONNET } from "./fixtures.js";

vi.mock("../src/lib/db.js", async () => (await import("./dbmock.js")).dbMockModule);
const { bedrockSend } = vi.hoisted(() => ({ bedrockSend: vi.fn() }));
vi.mock("../src/lib/aws.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/aws.js")>()),
  bedrockRuntime: () => ({ send: bedrockSend }),
}));

const { handleRequest } = await import("../src/api/router.js");
const { meRoutes } = await import("../src/api/me.js");
const { assistRoutes } = await import("../src/api/assist.js");
const { adminConfigRoutes } = await import("../src/api/admin-config.js");
const { getSettings } = await import("../src/lib/catalog.js");
const { DEFAULT_ASSISTANT_INSTRUCTIONS, DEFAULT_DATA_RULES, DEFAULT_LEARN_LINKS, DEFAULT_MODELS, DEFAULT_SETTINGS, SONNET_MODEL_ID, TITLE_MODEL_ID } =
  await import("../src/lib/defaults.js");
const { settingsSchema, MAX_REWRITE_CHARS } = await import("../src/lib/schemas.js");
const { buildSystem } = await import("../src/lib/converse.js");
const { buildRequest } = await import("../src/chat/stream.js");
const { generateTitle } = await import("../src/chat/title.js");
const { REWRITE_MAX_TOKENS, REWRITE_SYSTEM, firstJsonObject, parseRewriteReply } = await import("../src/lib/rewrite.js");
const { clearProfileCache } = await import("../src/lib/profile.js");
const { dayKey } = await import("../src/lib/usage.js");
const { REWRITE_DAILY_LIMIT } = await import("../src/lib/limits.js");
import type { AuthUser, ProfileStatus, Template } from "../src/lib/types.js";

const ALICE: AuthUser = { sub: "alice", email: "alice@x.org", username: "alice", isAdmin: false, status: "active" };
const ADMIN: AuthUser = { sub: "root", email: "root@x.org", username: "root", isAdmin: true, status: "active" };
const routes = [...meRoutes, ...assistRoutes, ...adminConfigRoutes];

interface CallOpts {
  body?: unknown;
  user?: AuthUser;
  /** Use the real profile status check (cached profile load) instead of treating every profile as active. */
  realStatus?: boolean;
}

async function call(method: string, path: string, opts: CallOpts = {}) {
  const user = opts.user ?? ALICE;
  const event = {
    rawPath: path,
    headers: { authorization: "Bearer test" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    requestContext: { http: { method } },
  } as unknown as APIGatewayProxyEventV2;
  const res = await handleRequest(event, {
    routes,
    allowedOrigin: "*",
    authenticate: async () => user,
    confirmAdmin: async () => user.isAdmin,
    ...(opts.realStatus ? {} : { resolveStatus: async () => "active" as ProfileStatus }),
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

const KEY = (pk: string, sk: string) => `${pk}\u0000${sk}`;
const profileOf = (sub = "alice") => store.get(KEY(`USER#${sub}`, "PROFILE"));
const seedProfile = (fields: Record<string, unknown>, sub = "alice") =>
  store.set(KEY(`USER#${sub}`, "PROFILE"), { PK: `USER#${sub}`, SK: "PROFILE", ...fields });

/** The next Bedrock call returns this text as the model's reply. */
const replyWith = (text: string, usage = { inputTokens: 40, outputTokens: 90 }) =>
  bedrockSend.mockResolvedValueOnce({ output: { message: { content: [{ text }] } }, usage });

const sentCommand = (index = 0) => bedrockSend.mock.calls[index]?.[0] as { input: Record<string, any> };

beforeEach(() => {
  resetDb();
  clearProfileCache();
  bedrockSend.mockReset();
});

describe("settings defaults on read", () => {
  it("fills the new fields from defaults for a stored settings item from before this change", async () => {
    const { assistantInstructions: _a, dataRules: _d, learnLinks: _l, helpContact: _h, ...oldShape } = DEFAULT_SETTINGS;
    store.set(KEY("CONFIG", "SETTINGS"), { PK: "CONFIG", SK: "SETTINGS", ...oldShape, appName: "Old name" });
    const settings = await getSettings();
    expect(settings.appName).toBe("Old name");
    expect(settings.assistantInstructions).toBe(DEFAULT_ASSISTANT_INSTRUCTIONS);
    expect(settings.dataRules).toEqual(DEFAULT_DATA_RULES);
    expect(settings.learnLinks).toEqual(DEFAULT_LEARN_LINKS);
    expect(settings.helpContact).toBe("");
  });

  it("keeps an empty list the admin chose instead of restoring the defaults", async () => {
    store.set(KEY("CONFIG", "SETTINGS"), { PK: "CONFIG", SK: "SETTINGS", ...DEFAULT_SETTINGS, dataRules: [], learnLinks: [] });
    const settings = await getSettings();
    expect(settings.dataRules).toEqual([]);
    expect(settings.learnLinks).toEqual([]);
  });

  it("seeds the new fields on a fresh table", async () => {
    const settings = await getSettings();
    expect(settings).toMatchObject({ dataRules: DEFAULT_DATA_RULES, learnLinks: DEFAULT_LEARN_LINKS, helpContact: "" });
  });
});

describe("settings validation", () => {
  const withSettings = (over: Record<string, unknown>) => settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...over });
  const link = (over: Record<string, unknown> = {}) => ({ title: "Course", url: "https://example.org/course", ...over });

  it("accepts the defaults", () => {
    expect(withSettings({}).success).toBe(true);
  });

  it("requires https learn links", () => {
    expect(withSettings({ learnLinks: [link({ url: "http://example.org/course" })] }).success).toBe(false);
    expect(withSettings({ learnLinks: [link({ url: "javascript:alert(1)" })] }).success).toBe(false);
    expect(withSettings({ learnLinks: [link({ url: "https://" })] }).success).toBe(false);
    expect(withSettings({ learnLinks: [link()] }).success).toBe(true);
  });

  it("caps learn links at 8, titles at 80, URLs at 500 and descriptions at 200", () => {
    expect(withSettings({ learnLinks: Array.from({ length: 8 }, () => link()) }).success).toBe(true);
    expect(withSettings({ learnLinks: Array.from({ length: 9 }, () => link()) }).success).toBe(false);
    expect(withSettings({ learnLinks: [link({ title: "t".repeat(81) })] }).success).toBe(false);
    expect(withSettings({ learnLinks: [link({ url: `https://example.org/${"a".repeat(490)}` })] }).success).toBe(false);
    expect(withSettings({ learnLinks: [link({ description: "d".repeat(200) })] }).success).toBe(true);
    expect(withSettings({ learnLinks: [link({ description: "d".repeat(201) })] }).success).toBe(false);
  });

  it("caps data rules at 10 items of 1 to 200 characters, trimmed", () => {
    expect(withSettings({ dataRules: Array.from({ length: 10 }, (_, i) => `rule ${i}`) }).success).toBe(true);
    expect(withSettings({ dataRules: Array.from({ length: 11 }, (_, i) => `rule ${i}`) }).success).toBe(false);
    expect(withSettings({ dataRules: ["   "] }).success).toBe(false);
    expect(withSettings({ dataRules: ["r".repeat(201)] }).success).toBe(false);
    const trimmed = withSettings({ dataRules: ["  Passwords  "] });
    expect(trimmed.success && trimmed.data.dataRules).toEqual(["Passwords"]);
  });

  it("caps assistant instructions at 4000 characters", () => {
    expect(withSettings({ assistantInstructions: "a".repeat(4000) }).success).toBe(true);
    expect(withSettings({ assistantInstructions: "a".repeat(4001) }).success).toBe(false);
  });

  it("accepts empty, an email address or an https link as help contact, and nothing else", () => {
    for (const ok of ["", "help@agency.gov", "https://agency.gov/help"]) expect(withSettings({ helpContact: ok }).success).toBe(true);
    for (const bad of ["agency.gov", "not an email", "http://agency.gov/help", "help@", "https://" + "a".repeat(200)]) {
      expect(withSettings({ helpContact: bad }).success).toBe(false);
    }
  });
});

describe("base assistant instructions in the system blocks", () => {
  const template: Template = {
    templateId: "t", title: "T", description: "", category: "General", systemPrompt: "TEMPLATE PROMPT", starterPrompt: "", enabled: true, sortOrder: 10,
  };
  const describe1 = (blocks: SystemContentBlock[] | undefined) => (blocks ?? []).map((b) => ("text" in b && b.text !== undefined ? b.text : "<cache point>"));

  it("puts assistant instructions first, then the template, then the sources, then the cache point", () => {
    const blocks = buildSystem(template, [{ title: "a.pdf", text: "alpha" }], true, "BASE INSTRUCTIONS");
    const texts = describe1(blocks);
    expect(texts[0]).toBe("BASE INSTRUCTIONS");
    expect(texts[1]).toBe("TEMPLATE PROMPT");
    expect(texts[2]).toContain('<source index="1" title="a.pdf">');
    expect(texts.at(-1)).toBe("<cache point>");
    expect(texts).toHaveLength(4);
  });

  it("leaves the instructions out when they are empty or only spaces", () => {
    expect(describe1(buildSystem(template, [], false, ""))).toEqual(["TEMPLATE PROMPT"]);
    expect(describe1(buildSystem(template, [], false, "   \n "))).toEqual(["TEMPLATE PROMPT"]);
    expect(buildSystem(undefined, [], false, "")).toBeUndefined();
  });

  it("sends the instructions alone when there is no template or source", () => {
    expect(describe1(buildSystem(undefined, [], false, "BASE"))).toEqual(["BASE"]);
  });

  it("trims the instructions before sending them", () => {
    expect(describe1(buildSystem(undefined, [], false, "  BASE  "))).toEqual(["BASE"]);
  });

  it("is in every chat request built from the stored settings, and dropped when the admin clears it", () => {
    const sonnet = model(SONNET);
    const req = buildRequest(prepared(sonnet), emptyContext(), []);
    expect(req.system?.[0]).toEqual({ text: DEFAULT_ASSISTANT_INSTRUCTIONS });
    const cleared = buildRequest(prepared(sonnet, { settings: { ...DEFAULT_SETTINGS, assistantInstructions: "" } }), emptyContext(), []);
    expect(cleared.system).toBeUndefined();
  });

  it("is not sent to title generation", async () => {
    bedrockSend.mockResolvedValueOnce({ output: { message: { content: [{ text: "A short title" }] } } });
    await generateTitle("Help me with a grant", "Sure.", TITLE_MODEL_ID);
    const system = JSON.stringify(sentCommand().input.system ?? []);
    expect(system).not.toContain("You are Genie");
  });
});

describe("beginner tips (hints)", () => {
  it("returns an empty list from /api/me when there is no profile", async () => {
    const res = await call("GET", "/api/me");
    expect(res.status).toBe(200);
    expect(res.body.hints).toEqual([]);
  });

  it("adds a tip once: a repeat is idempotent and nothing is duplicated", async () => {
    expect((await call("POST", "/api/me/hints", { body: { hint: "welcome" } })).body).toEqual({ hints: ["welcome"] });
    expect((await call("POST", "/api/me/hints", { body: { hint: "welcome" } })).body).toEqual({ hints: ["welcome"] });
    expect((await call("POST", "/api/me/hints", { body: { hint: "compare" } })).body).toEqual({ hints: ["welcome", "compare"] });
    expect(profileOf()?.hints).toEqual(["welcome", "compare"]);
  });

  it("creates a valid active profile for a user who has none", async () => {
    await call("POST", "/api/me/hints", { body: { hint: "templates" } });
    const profile = profileOf();
    expect(profile).toMatchObject({ status: "active", email: "alice@x.org", hints: ["templates"] });
    expect(typeof profile?.createdAt).toBe("string");
  });

  it("keeps the existing profile fields when it adds a tip", async () => {
    seedProfile({ status: "active", email: "old@x.org", createdAt: "2026-01-01T00:00:00.000Z", lastSeenAt: "2026-02-01T00:00:00.000Z" });
    await call("POST", "/api/me/hints", { body: { hint: "attach" } });
    expect(profileOf()).toMatchObject({ email: "old@x.org", createdAt: "2026-01-01T00:00:00.000Z", lastSeenAt: "2026-02-01T00:00:00.000Z", hints: ["attach"] });
  });

  it("reads tips fresh, so a tip added after the profile was cached shows on the next /api/me", async () => {
    seedProfile({ status: "active", email: "alice@x.org", createdAt: "2026-01-01T00:00:00.000Z" });
    expect((await call("GET", "/api/me", { realStatus: true })).body.hints).toEqual([]); // fills the profile cache
    await call("POST", "/api/me/hints", { body: { hint: "refine" }, realStatus: true });
    expect((await call("GET", "/api/me", { realStatus: true })).body.hints).toEqual(["refine"]);
  });

  it("refuses to write to a pending profile even when the middleware let the request through", async () => {
    seedProfile({ status: "pending", email: "alice@x.org", createdAt: "t" });
    const res = await call("POST", "/api/me/hints", { body: { hint: "welcome" } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PENDING_APPROVAL");
    expect(profileOf()?.hints).toBeUndefined();
  });

  it("refuses to write to a suspended or tombstoned profile and creates nothing", async () => {
    seedProfile({ status: "suspended", email: "alice@x.org", createdAt: "t" });
    expect((await call("POST", "/api/me/hints", { body: { hint: "welcome" } })).body.error.code).toBe("SUSPENDED");
    expect(profileOf()?.hints).toBeUndefined();
    seedProfile({ status: "deleted", email: "alice@x.org", createdAt: "t", expiresAt: 1 });
    expect((await call("POST", "/api/me/hints", { body: { hint: "welcome" } })).body.error.code).toBe("SUSPENDED");
    expect(profileOf()?.hints).toBeUndefined();
    expect(profileOf()?.status).toBe("deleted");
  });

  it("rejects an unknown tip id", async () => {
    const res = await call("POST", "/api/me/hints", { body: { hint: "nope" } });
    expect(res.status).toBe(400);
    expect(profileOf()).toBeUndefined();
  });

  it("DELETE clears every tip, returns an empty list and shows on the next /api/me", async () => {
    seedProfile({ status: "active", email: "alice@x.org", createdAt: "t", hints: ["welcome", "compare"] });
    expect((await call("DELETE", "/api/me/hints")).body).toEqual({ hints: [] });
    expect(profileOf()?.hints).toBeUndefined();
    expect(profileOf()?.status).toBe("active");
    expect((await call("GET", "/api/me")).body.hints).toEqual([]);
  });

  it("DELETE on a user with no profile creates nothing", async () => {
    expect((await call("DELETE", "/api/me/hints")).body).toEqual({ hints: [] });
    expect(store.has(KEY("USER#alice", "PROFILE"))).toBe(false);
  });

  it("DELETE is refused for a suspended profile and leaves its tips alone", async () => {
    seedProfile({ status: "suspended", email: "alice@x.org", createdAt: "t", hints: ["welcome"] });
    expect((await call("DELETE", "/api/me/hints")).body.error.code).toBe("SUSPENDED");
    expect(profileOf()?.hints).toEqual(["welcome"]);
  });

  it("lists tips in /api/me only for the signed-in person", async () => {
    seedProfile({ status: "active", email: "alice@x.org", createdAt: "t", hints: ["welcome"] });
    expect((await call("GET", "/api/me", { user: ADMIN })).body.hints).toEqual([]);
    expect((await call("GET", "/api/me")).body.hints).toEqual(["welcome"]);
  });
});

describe("rewrite helper", () => {
  const rewrite = (text: unknown, opts: CallOpts = {}) => call("POST", "/api/assist/rewrite", { body: { text }, ...opts });

  it("returns the rewrite, calls the title model without assistant instructions and records usage", async () => {
    replyWith('{"text":"Draft an email to [who] about the fence repair.","changes":["Added the audience"]}');
    const res = await rewrite("  write an email about the fence  ");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: "Draft an email to [who] about the fence repair.", changes: ["Added the audience"] });

    const cmd = sentCommand();
    expect(cmd.input.modelId).toBe(TITLE_MODEL_ID);
    expect(cmd.input.system).toEqual([{ text: REWRITE_SYSTEM }]);
    expect(cmd.input.messages[0].content[0].text).toBe("<request>\nwrite an email about the fence\n</request>");
    expect(cmd.input.inferenceConfig.maxTokens).toBe(REWRITE_MAX_TOKENS);

    const day = dayKey(new Date(), DEFAULT_SETTINGS.timezone);
    expect(store.get(KEY(`USAGE#${day}`, `MODEL#${TITLE_MODEL_ID}#USER#alice`))).toMatchObject({ requests: 1, inputTokens: 40, outputTokens: 90 });
    // Not a message: the daily counter is untouched.
    expect(store.has(KEY(`USAGE#${day}`, "COUNT#USER#alice"))).toBe(false);
  });

  it("falls back to the default model when the title model is disabled", async () => {
    // Haiku is both defaults out of the box, so pick a different default to make the fallback visible.
    store.set(KEY("CONFIG", "SETTINGS"), { PK: "CONFIG", SK: "SETTINGS", ...DEFAULT_SETTINGS, defaultModelId: SONNET_MODEL_ID });
    store.set(KEY("CONFIG", `MODEL#${TITLE_MODEL_ID}`), { PK: "CONFIG", SK: `MODEL#${TITLE_MODEL_ID}`, ...DEFAULT_MODELS.find((m) => m.modelId === TITLE_MODEL_ID), enabled: false });
    replyWith('{"text":"Clear request.","changes":[]}');
    expect((await rewrite("help")).status).toBe(200);
    expect(sentCommand().input.modelId).toBe(SONNET_MODEL_ID);
  });

  it("parses a reply that has prose and a code fence around the JSON, and ignores braces inside strings", async () => {
    replyWith('Sure, here it is:\n```json\n{"text": "Ask the team about {the} budget", "changes": ["Added a deadline", "x"]}\n```\nHope that helps {really}');
    expect((await rewrite("ask about budget")).body).toEqual({ text: "Ask the team about {the} budget", changes: ["Added a deadline", "x"] });
  });

  it("keeps at most 4 changes, each trimmed to 80 characters, and drops non-string items", () => {
    const reply = JSON.stringify({ text: "Clear.", changes: ["  one  ", 7, "", "two", "x".repeat(120), "four", "five"] });
    const parsed = parseRewriteReply(reply);
    expect(parsed?.changes).toEqual(["one", "two", "x".repeat(80), "four"]);
  });

  it("treats a missing or malformed changes list as empty", () => {
    expect(parseRewriteReply('{"text":"Clear."}')?.changes).toEqual([]);
    expect(parseRewriteReply('{"text":"Clear.","changes":"added a date"}')?.changes).toEqual([]);
  });

  it("finds the first complete JSON object only", () => {
    expect(firstJsonObject('x {"a": {"b": "}"}} trailing {"c": 1}')).toEqual({ a: { b: "}" } });
    expect(firstJsonObject("no json here")).toBeUndefined();
    expect(firstJsonObject('{"unclosed": "')).toBeUndefined();
  });

  it("returns ASSIST_FAILED when the reply is not usable JSON", async () => {
    replyWith("I cannot help with that.");
    const res = await rewrite("write something");
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("ASSIST_FAILED");
  });

  it("returns ASSIST_FAILED when the rewritten text is empty or longer than 8000 characters", async () => {
    replyWith('{"text":"   ","changes":[]}');
    expect((await rewrite("write something")).body.error.code).toBe("ASSIST_FAILED");
    replyWith(JSON.stringify({ text: "t".repeat(8001), changes: [] }));
    expect((await rewrite("write something")).body.error.code).toBe("ASSIST_FAILED");
  });

  it("returns ASSIST_FAILED for a model error, without the raw message", async () => {
    bedrockSend.mockRejectedValueOnce(Object.assign(new Error("secret model detail"), { name: "ValidationException" }));
    const res = await rewrite("write something");
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("ASSIST_FAILED");
    expect(JSON.stringify(res.body)).not.toContain("secret model detail");
  });

  it("maps throttling to the API's busy 503", async () => {
    bedrockSend.mockRejectedValueOnce(Object.assign(new Error("slow down"), { name: "ThrottlingException" }));
    const res = await rewrite("write something");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("UNAVAILABLE");
  });

  it("validates the input: trimmed, 1 to 8000 characters", async () => {
    expect((await rewrite("   ")).status).toBe(400);
    expect((await rewrite("x".repeat(MAX_REWRITE_CHARS + 1))).status).toBe(400);
    expect(bedrockSend).not.toHaveBeenCalled();
    replyWith(JSON.stringify({ text: "Clear.", changes: [] }));
    expect((await rewrite("x".repeat(MAX_REWRITE_CHARS))).status).toBe(200);
  });

  it("caps rewrites per person per day on their own counter, before any model call", async () => {
    const day = dayKey(new Date(), DEFAULT_SETTINGS.timezone);
    store.set(KEY(`USAGE#${day}`, "ASSIST#USER#alice"), { PK: `USAGE#${day}`, SK: "ASSIST#USER#alice", requests: REWRITE_DAILY_LIMIT });
    const res = await rewrite("write something");
    expect(res.status).toBe(429);
    expect((res.body as { error: { code: string } }).error.code).toBe("LIMIT_REACHED");
    expect(bedrockSend).not.toHaveBeenCalled();
    expect(store.has(KEY(`USAGE#${day}`, "COUNT#USER#alice"))).toBe(false);
  });

  it("gives the rewrite back when the model fails or replies with nothing usable", async () => {
    const day = dayKey(new Date(), DEFAULT_SETTINGS.timezone);
    bedrockSend.mockRejectedValueOnce(Object.assign(new Error("slow down"), { name: "ThrottlingException" }));
    expect((await rewrite("write something")).status).toBe(503);
    replyWith("not json at all");
    expect((await rewrite("write something")).status).toBe(502);
    expect(store.get(KEY(`USAGE#${day}`, "ASSIST#USER#alice"))).toMatchObject({ requests: 0 });
  });

  it("counts each rewrite on the helper counter", async () => {
    replyWith('{"text":"Clear.","changes":[]}');
    await rewrite("write something");
    const day = dayKey(new Date(), DEFAULT_SETTINGS.timezone);
    expect(store.get(KEY(`USAGE#${day}`, "ASSIST#USER#alice"))).toMatchObject({ requests: 1 });
  });

  it("is refused for a pending profile before any model call", async () => {
    seedProfile({ status: "pending", email: "alice@x.org", createdAt: "t" });
    const res = await rewrite("write something", { realStatus: true });
    expect(res.status).toBe(403);
    expect(bedrockSend).not.toHaveBeenCalled();
  });
});

describe("admin settings update", () => {
  const put = (body: unknown) => call("PUT", "/api/admin/settings", { body, user: ADMIN });

  it("saves the new fields and includes them in the audit record", async () => {
    const body = {
      ...DEFAULT_SETTINGS,
      assistantInstructions: "Keep answers short.",
      dataRules: ["Passwords"],
      learnLinks: [{ title: "Course", url: "https://example.org/course" }],
      helpContact: "help@agency.gov",
    };
    const res = await put(body);
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({ assistantInstructions: "Keep answers short.", dataRules: ["Passwords"], helpContact: "help@agency.gov" });
    const audit = [...store.values()].find((i) => i.PK === "AUDIT" && i.action === "settings.update");
    expect(audit?.details).toMatchObject({
      assistantInstructions: "Keep answers short.",
      dataRules: ["Passwords"],
      learnLinks: [{ title: "Course", url: "https://example.org/course" }],
      helpContact: "help@agency.gov",
    });
  });

  it("refuses a save that leaves out the new fields, naming the first one missing", async () => {
    const { assistantInstructions: _a, ...rest } = DEFAULT_SETTINGS;
    const res = await put(rest);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("assistantInstructions");
  });

  it("refuses a non-https learn link", async () => {
    const res = await put({ ...DEFAULT_SETTINGS, learnLinks: [{ title: "Course", url: "http://example.org/course" }] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("learnLinks");
  });
});

