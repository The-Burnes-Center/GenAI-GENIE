import type { Citation, Usage } from "./types.js";

export type ChatErrorCode =
  | "MODEL_DISABLED"
  | "LIMIT_REACHED"
  | "BAD_REQUEST"
  | "CONTEXT_TOO_LONG"
  | "BEDROCK_THROTTLED"
  | "BEDROCK_ERROR"
  | "REFUSED"
  | "INTERNAL";

export type NoticeCode =
  | "HISTORY_TRIMMED"
  | "ATTACHMENT_AS_TEXT"
  | "ATTACHMENTS_LIMITED"
  | "ATTACHMENT_EXPIRED"
  | "ATTACHMENT_TRUNCATED"
  | "SAVE_FAILED";

export type ChatEvent =
  | { type: "session"; sessionId: string; messageId: string; title: string }
  | { type: "ping" }
  | { type: "notice"; code: NoticeCode; message: string }
  | { type: "citations"; items: Citation[] }
  | { type: "reasoning"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; usage: Usage; latencyMs: number; stopReason: string }
  | { type: "title"; sessionId: string; title: string }
  | { type: "error"; code: ChatErrorCode; message: string; resetsAt?: string };

/** One event per line, newline terminated. JSON.stringify never emits raw newlines. */
export function encodeLine(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}
