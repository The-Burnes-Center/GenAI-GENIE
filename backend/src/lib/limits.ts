/** Limits shared across the chat pipeline, in one place so they cannot drift apart. */

/** Rough characters per token for budgeting (no tokenizer is available server-side). */
export const CHARS_PER_TOKEN = 3.5;

/** Extracted attachment text may use at most this share of (context window - max output). */
export const ATTACHMENT_TEXT_FRACTION = 0.5;

/**
 * Total raw attachment bytes (documents and images together) sent in one Converse request.
 * Bedrock's request body is capped around 25 MB; 20 MB leaves headroom for text and base64-free overhead.
 */
export const MAX_REQUEST_ATTACHMENT_BYTES = 20_000_000;

/** How much of a file is read to check its real type (zip and PDF markers sit near the start). */
export const SNIFF_BYTES = 100_000;

/**
 * ID tokens stay valid this long after a user is suspended or deleted unless the server checks live.
 * Keep equal to the user pool client's idToken validity in infra (auth.ts).
 */
export const TOKEN_VALIDITY_MINUTES = 15;

const DAY_SECONDS = 86_400;
/** Deleted-user tombstones live at least a day, and never less than twice the token validity. */
export const TOMBSTONE_TTL_SECONDS = Math.max(DAY_SECONDS, TOKEN_VALIDITY_MINUTES * 60 * 2);

/** One-day lifetime for pending-upload records, matching the staging/ lifecycle rule. */
export const UPLOAD_TTL_SECONDS = DAY_SECONDS;

export const attachmentPrefix = (sub: string) => `attachments/${sub}/`;
