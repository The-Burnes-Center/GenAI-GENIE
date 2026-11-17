import { CopyObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./aws.js";
import { getConfig } from "./config.js";
import { attachmentPrefix } from "./limits.js";
import { HttpError } from "./http.js";
import { randomUUID } from "node:crypto";
import type { Attachment, Message } from "./types.js";

/** DynamoDB items cap at 400 KB; anything over 300 KB of message text goes to S3. */
export const INLINE_CONTENT_LIMIT_BYTES = 300_000;
const PREVIEW_CHARS = 1000;

export const messageObjectKey = (sessionId: string, messageId: string) => `messages/${sessionId}/${messageId}.txt`;

/** Return the item to store, moving oversized content to S3 and leaving a pointer plus a short preview. */
export async function offloadContent(message: Message): Promise<Message> {
  if (Buffer.byteLength(message.content, "utf8") <= INLINE_CONTENT_LIMIT_BYTES) return message;
  const key = messageObjectKey(message.sessionId, message.messageId);
  await s3().send(
    new PutObjectCommand({ Bucket: getConfig().uploadsBucket, Key: key, Body: message.content, ContentType: "text/plain; charset=utf-8" }),
  );
  return { ...message, content: message.content.slice(0, PREVIEW_CHARS), contentKey: key };
}

/**
 * Replace pointers with the full text from S3. A fetch failure fails the request (unless `lenient`, for display only):
 * quietly substituting the preview would show (and send to the model) a truncated message.
 */
export const CONTENT_UNAVAILABLE_NOTE = "This long message could not be loaded right now. Reload to try again.";

export async function resolveContent(messages: Message[], opts: { lenient?: boolean } = {}): Promise<Message[]> {
  return Promise.all(
    messages.map(async (m) => {
      if (!m.contentKey) return m;
      try {
        const out = await s3().send(new GetObjectCommand({ Bucket: getConfig().uploadsBucket, Key: m.contentKey }));
        const text = await out.Body?.transformToString("utf-8");
        if (text === undefined) throw new Error("empty body");
        const { contentKey: _key, ...rest } = m;
        return { ...rest, content: text };
      } catch (err) {
        console.error(JSON.stringify({ level: "error", message: "message body fetch failed", key: m.contentKey, error: String(err) }));
        // Viewing a chat degrades per message; anything that feeds the model must fail instead.
        if (opts.lenient) {
          const { contentKey: _key, ...rest } = m;
          return { ...rest, content: CONTENT_UNAVAILABLE_NOTE, contentUnavailable: true };
        }
        throw new HttpError("INTERNAL", "A long message could not be loaded. Please try again.");
      }
    }),
  );
}

/** Delete objects by key, in batches of 1000. */
export async function deleteObjects(keys: string[]): Promise<void> {
  const Bucket = getConfig().uploadsBucket;
  for (let i = 0; i < keys.length; i += 1000) {
    await s3().send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true } }));
  }
}

export async function deleteSessionObjects(sessionId: string): Promise<void> {
  const Bucket = getConfig().uploadsBucket;
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket, Prefix: `messages/${sessionId}/`, ContinuationToken: token }));
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length > 0) await s3().send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }));
    token = page.NextContinuationToken;
  } while (token);
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

async function copyKey(from: string, to: string): Promise<boolean> {
  const Bucket = getConfig().uploadsBucket;
  try {
    await s3().send(new CopyObjectCommand({ Bucket, Key: to, CopySource: `${Bucket}/${encodeKey(from)}` }));
    return true;
  } catch (err) {
    if (["NoSuchKey", "NotFound"].includes((err as Error)?.name)) return false;
    throw err;
  }
}

/**
 * Copy an attachment (and its cached text extraction, if any) to a fresh key under the user's own
 * prefix, so the copy outlives the original. An already-expired original is left as is.
 */
export async function copyAttachment(sub: string, att: Attachment): Promise<Attachment> {
  if (!att.key.startsWith(attachmentPrefix(sub))) return att;
  const name = att.key.split("/").pop() ?? "file";
  const key = `${attachmentPrefix(sub)}${randomUUID()}/${name}`;
  if (!(await copyKey(att.key, key))) return att;
  await copyKey(`${att.key}.txt`, `${key}.txt`);
  return { ...att, key };
}
