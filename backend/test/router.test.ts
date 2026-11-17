import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { handleRequest, matchRoute, route, type RouterDeps } from "../src/api/router.js";
import { HttpError } from "../src/lib/http.js";
import type { AuthUser, ProfileStatus } from "../src/lib/types.js";

const routes = [
  route("GET", "/api/ping", async () => ({ status: 200, body: { ok: true } })),
  route("GET", "/api/items/{id}", async ({ params }) => ({ status: 200, body: { id: params.id } })),
  route("GET", "/api/admin/secret", async () => ({ status: 200, body: { secret: 1 } }), { admin: true }),
];

const user = (isAdmin: boolean): AuthUser => ({ sub: "u", email: "u@x.org", username: "u", isAdmin, status: "active" });

function deps(over: Partial<RouterDeps> & { admin?: boolean; status?: ProfileStatus } = {}): RouterDeps {
  return {
    routes,
    allowedOrigin: "*",
    confirmAdmin: async () => true,
    authenticate: async (h) => {
      if (!h.authorization) throw new HttpError("UNAUTHORIZED", "no");
      return user(over.admin ?? false);
    },
    resolveStatus: async () => {
      if (over.status === "pending") throw new HttpError("PENDING_APPROVAL", "wait");
      if (over.status === "suspended") throw new HttpError("SUSPENDED", "no");
      return "active";
    },
    ...over,
  };
}

const event = (method: string, path: string, auth = true): APIGatewayProxyEventV2 =>
  ({
    rawPath: path,
    headers: auth ? { authorization: "Bearer x" } : {},
    requestContext: { http: { method } },
  }) as unknown as APIGatewayProxyEventV2;

const body = (r: { body?: string | undefined }) => JSON.parse(r.body ?? "null");

describe("router", () => {
  it("401 without a token, even for unknown paths", async () => {
    expect((await handleRequest(event("GET", "/api/ping", false), deps())).statusCode).toBe(401);
    expect((await handleRequest(event("GET", "/api/nope", false), deps())).statusCode).toBe(401);
  });

  it("404 for unknown routes and wrong methods", async () => {
    const r = await handleRequest(event("GET", "/api/nope"), deps());
    expect(r.statusCode).toBe(404);
    expect(body(r).error.code).toBe("NOT_FOUND");
    expect((await handleRequest(event("POST", "/api/ping"), deps())).statusCode).toBe(404);
  });

  it("403 on admin routes for non-admins, 200 for admins", async () => {
    expect((await handleRequest(event("GET", "/api/admin/secret"), deps())).statusCode).toBe(403);
    expect((await handleRequest(event("GET", "/api/admin/secret"), deps({ admin: true }))).statusCode).toBe(200);
  });

  it("gates pending and suspended profiles with distinct codes", async () => {
    const pending = await handleRequest(event("GET", "/api/ping"), deps({ status: "pending" }));
    expect(pending.statusCode).toBe(403);
    expect(body(pending).error.code).toBe("PENDING_APPROVAL");
    const suspended = await handleRequest(event("GET", "/api/ping"), deps({ status: "suspended" }));
    expect(body(suspended).error.code).toBe("SUSPENDED");
  });

  it("answers preflight without auth and decodes path params", async () => {
    expect((await handleRequest(event("OPTIONS", "/api/ping", false), deps())).statusCode).toBe(204);
    const r = await handleRequest(event("GET", "/api/items/openai.gpt-oss-120b-1%3A0"), deps());
    expect(body(r)).toEqual({ id: "openai.gpt-oss-120b-1:0" });
  });

  it("never leaks internals on unexpected errors", async () => {
    const boom = [route("GET", "/api/boom", async () => { throw new Error("secret stack detail"); })];
    const r = await handleRequest(event("GET", "/api/boom"), deps({ routes: boom }));
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("secret stack detail");
    expect(body(r).error.code).toBe("INTERNAL");
  });

  it("matchRoute returns undefined for malformed escapes", () => {
    expect(matchRoute(routes, "GET", "/api/items/%E0%A4%A")).toBeUndefined();
  });
});
