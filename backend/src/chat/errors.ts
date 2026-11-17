import { HttpError } from "../lib/http.js";
import type { ChatErrorCode, ChatEvent } from "../lib/ndjson.js";

/** A failure that maps directly onto an `error` line of the stream. */
export class ChatFailure extends Error {
  constructor(
    readonly code: ChatErrorCode,
    message: string,
    /** Set on LIMIT_REACHED: when the daily count resets (ISO time). */
    readonly resetsAt?: string,
  ) {
    super(message);
  }
}

export function bedrockFailure(err: unknown): ChatFailure {
  const name = (err as Error)?.name ?? "";
  if (name === "ThrottlingException" || name === "ServiceQuotaExceededException" || name === "TooManyRequestsException") {
    return new ChatFailure("BEDROCK_THROTTLED", "The model is busy right now. Try again in a moment.");
  }
  if (name === "AccessDeniedException") {
    return new ChatFailure("BEDROCK_ERROR", "This model is not available to the app. Ask an administrator to check model access.");
  }
  if (name === "ValidationException") {
    // The raw message can echo prompt or internal detail: it is logged by the caller, never sent to the user.
    return new ChatFailure("BEDROCK_ERROR", "The model could not process this request. Try rephrasing it or removing attachments.");
  }
  if (name === "AbortError" || name === "TimeoutError") {
    return new ChatFailure("BEDROCK_ERROR", "The model took too long to respond.");
  }
  return new ChatFailure("BEDROCK_ERROR", "The model could not complete the request. Try again.");
}

/** Turn anything thrown into a safe `error` event; log details with the request id. */
export function toErrorEvent(err: unknown, requestId: string): Extract<ChatEvent, { type: "error" }> {
  if (err instanceof ChatFailure) {
    return { type: "error", code: err.code, message: err.message, ...(err.resetsAt ? { resetsAt: err.resetsAt } : {}) };
  }
  if (err instanceof HttpError) {
    return { type: "error", code: err.code === "INTERNAL" ? "INTERNAL" : "BAD_REQUEST", message: err.message };
  }
  console.error(JSON.stringify({ level: "error", requestId, message: String(err), stack: (err as Error)?.stack }));
  return { type: "error", code: "INTERNAL", message: `Something went wrong (request ${requestId})` };
}
