import { randomUUID } from "node:crypto";
import type { ErrorBody } from "./api-types.js";

export type ErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "PENDING_APPROVAL" | "SUSPENDED" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE" | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PENDING_APPROVAL: 403,
  SUSPENDED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class HttpError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.status = STATUS_BY_CODE[code];
  }
}

export const badRequest = (message: string) => new HttpError("BAD_REQUEST", message);
export const unauthorized = (message = "Sign in required") => new HttpError("UNAUTHORIZED", message);
export const forbidden = (message = "You do not have access to this") => new HttpError("FORBIDDEN", message);
export const notFound = (message = "Not found") => new HttpError("NOT_FOUND", message);
export const conflict = (message: string) => new HttpError("CONFLICT", message);

export interface ApiResult {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Name the response type at the call site (`ok<SessionResponse>(...)`) so the body is checked against the contract. */
export const ok = <T = unknown>(body: T): ApiResult => ({ status: 200, body });
export const noContent = (): ApiResult => ({ status: 204 });

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}

export const newRequestId = (): string => randomUUID();

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-max-age": "600",
  };
}

/** Log the real error server-side; return only a safe message to the caller. */
export function toErrorResult(err: unknown, requestId: string): ApiResult {
  if (err instanceof HttpError) {
    return { status: err.status, body: errorBody(err.code, err.message) };
  }
  console.error(JSON.stringify({ level: "error", requestId, message: String(err), stack: (err as Error)?.stack }));
  return { status: 500, body: errorBody("INTERNAL", `Something went wrong (request ${requestId})`) };
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T>(cursor: string | undefined): T | undefined {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    throw badRequest("Invalid cursor");
  }
}
