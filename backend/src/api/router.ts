import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { authenticate as defaultAuthenticate, requireAdmin } from "../lib/auth.js";
import { confirmAdmin as defaultConfirmAdmin, type AdminCheck } from "../lib/admin-check.js";
import { writeAudit } from "../lib/audit.js";
import { resolveStatus as defaultResolveStatus } from "../lib/profile.js";
import { corsHeaders, errorBody, HttpError, newRequestId, notFound, toErrorResult, type ApiResult } from "../lib/http.js";
import type { AuthUser, ProfileStatus } from "../lib/types.js";

export interface RouteContext {
  user: AuthUser;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  rawBody: string | undefined;
  requestId: string;
}

export type RouteHandler = (ctx: RouteContext) => Promise<ApiResult>;

export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  admin: boolean;
  /** No sign-in: bypasses JWT verification and the profile check. Handlers must expose nothing private. */
  public: boolean;
  handler: RouteHandler;
}

/** `/api/sessions/{id}` becomes a regex plus the list of parameter names. */
export function route(method: string, path: string, handler: RouteHandler, opts: { admin?: boolean; public?: boolean } = {}): Route {
  const keys: string[] = [];
  const source = path.replace(/\{(\w+)\}/g, (_m, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { method, pattern: new RegExp(`^${source}/?$`), keys, admin: opts.admin ?? false, public: opts.public ?? false, handler };
}

export function matchRoute(routes: Route[], method: string, path: string): { route: Route; params: Record<string, string> } | undefined {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    for (const [i, key] of r.keys.entries()) {
      try {
        params[key] = decodeURIComponent(m[i + 1] ?? "");
      } catch {
        return undefined;
      }
    }
    return { route: r, params };
  }
  return undefined;
}

export interface RouterDeps {
  routes: Route[];
  authenticate?: (headers: Record<string, string | undefined>) => Promise<AuthUser>;
  /** Loads the profile and throws 403 for pending or suspended accounts. */
  resolveStatus?: (user: AuthUser) => Promise<ProfileStatus>;
  /** Live check that a token-claimed admin is still in the admin group. */
  confirmAdmin?: (user: AuthUser) => Promise<AdminCheck>;
  allowedOrigin: string;
}

const ANONYMOUS: AuthUser = Object.freeze({ sub: "", email: "", username: "", isAdmin: false, status: "active" }) as AuthUser;

interface Authenticated {
  user: AuthUser;
  /** Cognito could not be asked whether a token-claimed admin is still an admin. */
  adminUnconfirmed: boolean;
}

/**
 * A token-claimed admin is confirmed live. If that check is unavailable, read-only (GET) requests fall back
 * to the token's claim; anything that changes data is treated as non-admin (fail closed).
 */
async function authenticateUser(event: APIGatewayProxyEventV2, deps: RouterDeps, method: string): Promise<Authenticated> {
  const verified = await (deps.authenticate ?? defaultAuthenticate)(event.headers ?? {});
  const status = await (deps.resolveStatus ?? defaultResolveStatus)(verified);
  const check: AdminCheck = verified.isAdmin ? await (deps.confirmAdmin ?? defaultConfirmAdmin)(verified) : false;
  const isAdmin = check === "unknown" ? method === "GET" : check;
  return { user: { ...verified, status, isAdmin }, adminUnconfirmed: check === "unknown" };
}

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

function toResponse(result: ApiResult, cors: Record<string, string>): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: result.status,
    headers: { ...JSON_HEADERS, ...cors, ...result.headers },
    ...(result.body === undefined ? {} : { body: JSON.stringify(result.body) }),
  };
}

/** Order: CORS preflight, 401 (every request is authenticated), profile status 403, 404, 403 (admin routes), handler. */
export async function handleRequest(event: APIGatewayProxyEventV2, deps: RouterDeps): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId = newRequestId();
  const cors = corsHeaders(deps.allowedOrigin);
  const method = event.requestContext.http.method.toUpperCase();
  if (method === "OPTIONS") return { statusCode: 204, headers: cors };
  try {
    const matched = matchRoute(deps.routes, method, event.rawPath);
    // Only explicitly public routes skip authentication; everything else, including unknown paths, needs a token.
    const auth = matched?.route.public ? { user: ANONYMOUS, adminUnconfirmed: false } : await authenticateUser(event, deps, method);
    const user = auth.user;
    if (!matched) throw notFound();
    if (matched.route.admin && !user.isAdmin && auth.adminUnconfirmed) {
      // An infrastructure failure, not a refusal: tell the user to retry and do not record a denied attempt.
      throw new HttpError("UNAVAILABLE", "Couldn't confirm administrator access, try again.");
    }
    if (matched.route.admin && !user.isAdmin) {
      await writeAudit(user, "admin.denied", event.rawPath, { method });
    }
    if (matched.route.admin) requireAdmin(user);
    const rawBody = event.body && event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    const result = await matched.route.handler({
      user,
      params: matched.params,
      query: event.queryStringParameters ?? {},
      rawBody,
      requestId,
    });
    return toResponse(result, cors);
  } catch (err) {
    return toResponse(toErrorResult(err, requestId), cors);
  }
}

export { errorBody };
