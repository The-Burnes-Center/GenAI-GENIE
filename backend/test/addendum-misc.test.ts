import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbMockModule, resetDb, store } from "./dbmock.js";

vi.mock("../src/lib/db.js", async () => (await import("./dbmock.js")).dbMockModule);

const { handleRequest, route } = await import("../src/api/router.js");
const { meRoutes } = await import("../src/api/me.js");
const { adminConfigRoutes } = await import("../src/api/admin-config.js");
const { checkRequest } = await import("../src/chat/prepare.js");
const { ChatFailure, toErrorEvent } = await import("../src/chat/errors.js");
const { dayKey, countRequestsToday, recordUsage, reserveRequest, refundRequest } = await import("../src/lib/usage.js");
const { localDate, nextMidnight, isValidTimezone } = await import("../src/lib/tz.js");
const { DEFAULT_SETTINGS } = await import("../src/lib/defaults.js");
const { settingsSchema, parseWith } = await import("../src/lib/schemas.js");
const { handler: postConfirmation } = await import("../src/triggers/post-confirmation.js");
import { HttpError } from "../src/lib/http.js";

const ev = (method: string, path: string, headers: Record<string, string> = {}): APIGatewayProxyEventV2 =>
  ({ rawPath: path, headers, requestContext: { http: { method } } }) as unknown as APIGatewayProxyEventV2;

beforeEach(() => {
  resetDb();
  process.env.TABLE_NAME = "t";
  process.env.UPLOADS_BUCKET = "b";
  process.env.AUTH_PARAMETER_NAME = "/x/genie/auth";
  process.env.KNOWLEDGE_BASE_ID = "kb";
  process.env.DATA_SOURCE_ID = "ds";
  delete process.env.EMAIL_OTP;
});

describe("public route bypass", () => {
  it("serves /api/public-config without a token and never touches auth or profile checks", async () => {
    const authenticate = vi.fn(async () => {
      throw new HttpError("UNAUTHORIZED", "no");
    });
    const resolveStatus = vi.fn();
    const res = await handleRequest(ev("GET", "/api/public-config"), { routes: meRoutes, allowedOrigin: "*", authenticate, resolveStatus });
    expect(res.statusCode).toBe(200);
    expect(authenticate).not.toHaveBeenCalled();
    expect(resolveStatus).not.toHaveBeenCalled();
    expect(res.headers?.["cache-control"]).toBe("public, max-age=60");
    expect(JSON.parse(res.body ?? "")).toEqual({ appName: "Genie", signupMode: "off", allowedEmailDomains: [], emailOtp: false });
  });

  it("exposes only the four public fields, even when settings hold more", async () => {
    store.set("CONFIG\u0000SETTINGS", { PK: "CONFIG", SK: "SETTINGS", ...DEFAULT_SETTINGS, signupMode: "open", allowedEmailDomains: ["x.org"], disclaimer: "private text" });
    process.env.EMAIL_OTP = "true";
    // config is cached per process; rebuild the expectation from whatever it read
    const res = await handleRequest(ev("GET", "/api/public-config"), { routes: meRoutes, allowedOrigin: "*" });
    const body = JSON.parse(res.body ?? "");
    expect(Object.keys(body).sort()).toEqual(["allowedEmailDomains", "appName", "emailOtp", "signupMode"]);
    expect(body).toMatchObject({ signupMode: "open", allowedEmailDomains: ["x.org"] });
  });

  it("keeps every other route authenticated, including unknown paths and other methods on the public path", async () => {
    const authenticate = vi.fn(async () => {
      throw new HttpError("UNAUTHORIZED", "no");
    });
    const routes = [...meRoutes, route("GET", "/api/private", async () => ({ status: 200, body: {} }))];
    for (const [m, p] of [["GET", "/api/me"], ["GET", "/api/private"], ["GET", "/api/nope"], ["POST", "/api/public-config"], ["GET", "/api/bootstrap"]] as const) {
      const res = await handleRequest(ev(m, p), { routes, allowedOrigin: "*", authenticate });
      expect(res.statusCode, `${m} ${p}`).toBe(401);
    }
  });
});

describe("timezone day boundary", () => {
  const NY = "America/New_York";

  it("rolls the local date at midnight New York across the UTC date", () => {
    expect(localDate(new Date("2026-11-18T04:59:59Z"), NY)).toBe("2026-11-17");
    expect(localDate(new Date("2026-11-18T05:00:00Z"), NY)).toBe("2026-11-18");
    expect(localDate(new Date("2026-11-18T05:00:00Z"), "UTC")).toBe("2026-11-18");
    expect(dayKey(new Date("2026-11-18T03:00:00Z"), NY)).toBe("2026-11-17");
  });

  it("computes the next local midnight, including DST changes", () => {
    expect(nextMidnight(new Date("2026-11-18T04:59:59Z"), NY).toISOString()).toBe("2026-11-18T05:00:00.000Z");
    expect(nextMidnight(new Date("2026-11-18T05:00:00Z"), NY).toISOString()).toBe("2026-11-19T05:00:00.000Z");
    // fall back on 2026-11-01: that local day has 25 hours, so the next midnight is at 05:00Z
    expect(nextMidnight(new Date("2026-11-01T12:00:00Z"), NY).toISOString()).toBe("2026-11-02T05:00:00.000Z");
    // spring forward on 2026-03-08: 23-hour day
    expect(nextMidnight(new Date("2026-03-08T12:00:00Z"), NY).toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("reserves in the local day of the request: before and after midnight use different counters", async () => {
    const before = new Date("2026-11-18T04:59:00Z");
    const after = new Date("2026-11-18T05:01:00Z");
    const r1 = await reserveRequest("u1", 5, NY, before);
    await reserveRequest("u1", 5, NY, before);
    const r3 = await reserveRequest("u1", 5, NY, after);
    expect(r1?.pk).toBe("USAGE#2026-11-17");
    expect(r3?.pk).toBe("USAGE#2026-11-18");
    expect(await countRequestsToday("u1", NY, before)).toBe(2);
    expect(await countRequestsToday("u1", NY, after)).toBe(1);
    // tokens land in the day the request was reserved, even if it finishes after midnight
    await recordUsage({ modelId: "m", sub: "u1", email: "u@x.org", usage: { inputTokens: 3, outputTokens: 4 }, reservation: r1! });
    expect(store.get("USAGE#2026-11-17\u0000MODEL#m#USER#u1")).toMatchObject({ requests: 1, inputTokens: 3 });
    expect(dbMockModule.queryPartition).not.toHaveBeenCalled();
  });

  it("refuses at the limit, refunds on failure, and never overshoots", async () => {
    expect(await reserveRequest("u2", 2, NY)).toBeDefined();
    const second = await reserveRequest("u2", 2, NY);
    expect(await reserveRequest("u2", 2, NY)).toBeUndefined();
    await refundRequest(second!);
    expect(await reserveRequest("u2", 2, NY)).toBeDefined();
    expect(await countRequestsToday("u2", NY)).toBe(2);
    expect(await reserveRequest("u3", 0, NY)).toBeDefined(); // unlimited still counts
    expect(await countRequestsToday("u3", NY)).toBe(1);
  });

  it("validates time zones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
    expect(() => parseWith(settingsSchema, { ...DEFAULT_SETTINGS, timezone: "Mars/Base" })).toThrow(HttpError);
    expect(DEFAULT_SETTINGS.timezone).toBe(NY);
  });

  it("LIMIT_REACHED carries resetsAt for the next local midnight", async () => {
    store.set("CONFIG\u0000SETTINGS", { PK: "CONFIG", SK: "SETTINGS", ...DEFAULT_SETTINGS, dailyMessageLimit: 1 });
    store.set("CONFIG\u0000SEEDED#MODEL", {});
    store.set("CONFIG\u0000MODEL#m", { PK: "CONFIG", SK: "MODEL#m", modelId: "m", label: "M", enabled: true, capabilities: {}, sortOrder: 1 });
    const today = dayKey(new Date(), NY);
    store.set(`USAGE#${today}\u0000COUNT#USER#u1`, { PK: `USAGE#${today}`, SK: "COUNT#USER#u1", requests: 1 });
    const user = { sub: "u1", email: "u@x.org", username: "u1", isAdmin: false, status: "active" as const };
    const err = await checkRequest(user, { modelId: "m", prompt: "hi", attachments: [], mode: "chat" }).catch((e) => e);
    expect(err).toBeInstanceOf(ChatFailure);
    expect(err.code).toBe("LIMIT_REACHED");
    expect(new Date(err.resetsAt).getTime()).toBeGreaterThan(Date.now());
    expect(toErrorEvent(err, "r")).toMatchObject({ type: "error", code: "LIMIT_REACHED", resetsAt: err.resetsAt });
  });
});

describe("settings and defaults", () => {
  it("defaults include template categories and accept an edited list", () => {
    expect(DEFAULT_SETTINGS.templateCategories).toEqual(["Writing", "Summaries", "Planning", "Communication", "Policy", "Translation"]);
    expect(parseWith(settingsSchema, { ...DEFAULT_SETTINGS, templateCategories: ["A", "B"] }).templateCategories).toEqual(["A", "B"]);
    expect(() => parseWith(settingsSchema, { ...DEFAULT_SETTINGS, templateCategories: [] })).toThrow(HttpError);
  });

  it("admin settings route is admin only", async () => {
    const user = { sub: "u", email: "", username: "u", isAdmin: false, status: "active" as const };
    const res = await handleRequest(
      { ...ev("GET", "/api/admin/settings", { authorization: "Bearer x" }) },
      { routes: adminConfigRoutes, allowedOrigin: "*", authenticate: async () => user, resolveStatus: async () => "active" },
    );
    expect(res.statusCode).toBe(403);
  });
});

describe("post confirmation", () => {
  const event = (source: string) =>
    ({ triggerSource: source, request: { userAttributes: { sub: "s1", email: "New@X.org" } } }) as never;

  it("creates a pending profile and queue entry when approval is required", async () => {
    await postConfirmation(event("PostConfirmation_ConfirmSignUp"));
    expect(store.get("USER#s1\u0000PROFILE")).toMatchObject({ status: "pending", email: "new@x.org" });
    expect(store.has("PENDING\u0000s1")).toBe(true);
  });

  it("creates an active profile without a queue entry when approval is off", async () => {
    store.set("CONFIG\u0000SETTINGS", { PK: "CONFIG", SK: "SETTINGS", ...DEFAULT_SETTINGS, requireApproval: false });
    await postConfirmation(event("PostConfirmation_ConfirmSignUp"));
    expect(store.get("USER#s1\u0000PROFILE")).toMatchObject({ status: "active" });
    expect(store.has("PENDING\u0000s1")).toBe(false);
  });

  it("ignores forgot-password confirmations", async () => {
    await postConfirmation(event("PostConfirmation_ConfirmForgotPassword"));
    expect(store.size).toBe(0);
  });
});
