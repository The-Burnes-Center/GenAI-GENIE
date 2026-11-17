import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../lib/aws.js";
import { getConfig } from "../lib/config.js";
import type { LoadedAttachment } from "../lib/converse.js";
import { extractDocumentText } from "../lib/extract.js";
import {
  classifyFile, MAX_ATTACHMENT_DOC_BYTES, MAX_DOCUMENTS_PER_MESSAGE, MAX_IMAGES_PER_MESSAGE, MAX_IMAGE_BYTES,
  TEXT_EXTRACTABLE, verifyKind, type FileKind,
} from "../lib/files.js";
import { badRequest } from "../lib/http.js";
import { ATTACHMENT_TEXT_FRACTION, attachmentPrefix, CHARS_PER_TOKEN, MAX_REQUEST_ATTACHMENT_BYTES } from "../lib/limits.js";
import type { Attachment, Message, ModelEntry } from "../lib/types.js";

export interface Notice {
  code: "ATTACHMENTS_LIMITED" | "ATTACHMENT_EXPIRED" | "ATTACHMENT_TRUNCATED";
  message: string;
}

/** Seam for tests: the object store behind attachments. `undefined` means the object is gone (expired). */
export interface ObjectStore {
  getObject(key: string): Promise<{ bytes: Uint8Array; contentType?: string | undefined } | undefined>;
  getText(key: string): Promise<string | undefined>;
  putText(key: string, text: string): Promise<void>;
}

const isMissing = (err: unknown) => ["NoSuchKey", "NotFound"].includes((err as Error)?.name);

export const s3ObjectStore: ObjectStore = {
  async getObject(key) {
    try {
      const out = await s3().send(new GetObjectCommand({ Bucket: getConfig().uploadsBucket, Key: key }));
      const bytes = await out.Body?.transformToByteArray();
      return bytes ? { bytes, contentType: out.ContentType } : undefined;
    } catch (err) {
      if (isMissing(err)) return undefined;
      throw err;
    }
  },
  async getText(key) {
    try {
      const out = await s3().send(new GetObjectCommand({ Bucket: getConfig().uploadsBucket, Key: key }));
      return await out.Body?.transformToString("utf-8");
    } catch (err) {
      if (isMissing(err)) return undefined;
      throw err;
    }
  },
  async putText(key, text) {
    await s3().send(new PutObjectCommand({ Bucket: getConfig().uploadsBucket, Key: key, Body: text, ContentType: "text/plain; charset=utf-8" }));
  },
};

export interface ResolvedAttachments {
  current: LoadedAttachment[];
  /** Attachments of earlier user messages, by message id. */
  byMessage: Map<string, LoadedAttachment[]>;
  notices: Notice[];
  /** Current-turn documents sent as extracted text because the model has no document support. */
  textFiles: string[];
}

type Mode = "bytes" | "text" | "skip-limit" | "skip";
interface Item {
  messageId: string | undefined; // undefined = the current turn
  att: Attachment;
  kind: FileKind;
  mode: Mode;
}

/** Characters of extracted text allowed in one request: ATTACHMENT_TEXT_FRACTION of the usable window. */
export function textBudgetChars(model: Pick<ModelEntry, "contextWindow" | "maxOutputTokens">): number {
  return Math.floor(ATTACHMENT_TEXT_FRACTION * Math.max(0, model.contextWindow - model.maxOutputTokens) * CHARS_PER_TOKEN);
}

/** Newest attachments keep their bytes (5 documents, 20 images per request); older ones fall back to text or are dropped. */
export function assignModes(items: Omit<Item, "mode">[], model: ModelEntry): Item[] {
  let docs = MAX_DOCUMENTS_PER_MESSAGE;
  let images = MAX_IMAGES_PER_MESSAGE;
  const out: Item[] = [];
  for (const item of [...items].reverse()) {
    let mode: Mode;
    if (item.kind.kind === "image") {
      if (!model.capabilities.vision) mode = "skip";
      else if (images > 0) (images--, (mode = "bytes"));
      else mode = "skip-limit";
    } else if (model.capabilities.documents && docs > 0) {
      docs--;
      mode = "bytes";
    } else if (TEXT_EXTRACTABLE.has(item.kind.format)) {
      mode = "text";
    } else {
      mode = model.capabilities.documents ? "skip-limit" : "skip";
    }
    out.push({ ...item, mode });
  }
  return out.reverse();
}

async function loadBytes(store: ObjectStore, item: Item): Promise<{ bytes: Uint8Array; kind: FileKind } | undefined> {
  const object = await store.getObject(item.att.key);
  if (!object) return undefined;
  const limit = item.kind.kind === "image" ? MAX_IMAGE_BYTES : MAX_ATTACHMENT_DOC_BYTES;
  if (object.bytes.length > limit) throw badRequest(`${item.att.name}: file is too large`);
  // Trust neither the client type nor the stored type: the bytes must look like what they claim to be.
  const declared = classifyFile(object.contentType || item.att.contentType, item.att.name) ?? item.kind;
  return { bytes: object.bytes, kind: verifyKind(declared, object.bytes, item.att.name) };
}

/** Extracted text, cached next to the object (`<key>.txt`) so later turns do not re-extract. */
async function loadText(store: ObjectStore, item: Item): Promise<string | undefined> {
  const cached = await store.getText(`${item.att.key}.txt`);
  if (cached !== undefined) return cached;
  const loaded = await loadBytes(store, item);
  if (!loaded) return undefined;
  return extractAndCache(store, item, loaded);
}

async function extractAndCache(store: ObjectStore, item: Item, loaded: { bytes: Uint8Array; kind: FileKind }): Promise<string | undefined> {
  if (loaded.kind.kind !== "document") return undefined;
  const text = await extractDocumentText(loaded.kind.format, item.att.name, loaded.bytes);
  await store.putText(`${item.att.key}.txt`, text).catch((err) => console.error(JSON.stringify({ level: "error", message: "extraction cache write failed", error: String(err) })));
  return text;
}

export async function resolveAttachments(
  sub: string,
  history: Message[],
  current: Attachment[],
  model: ModelEntry,
  store: ObjectStore = s3ObjectStore,
): Promise<ResolvedAttachments> {
  const owned = (a: Attachment) => a.key.startsWith(attachmentPrefix(sub));
  for (const a of current) if (!owned(a)) throw badRequest(`${a.name}: attachment does not belong to you`);

  const raw: Omit<Item, "mode">[] = [];
  const ordered = [...history].filter((m) => m.role === "user" && m.attachments?.length).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (const m of ordered) {
    for (const att of m.attachments ?? []) {
      const kind = classifyFile(att.contentType, att.name);
      if (kind && owned(att)) raw.push({ messageId: m.messageId, att, kind });
    }
  }
  for (const att of current) raw.push({ messageId: undefined, att, kind: classifyFile(att.contentType, att.name) as FileKind });

  const items = assignModes(raw, model);
  const notices: Notice[] = [];
  const limited = items.filter((i) => i.mode === "skip-limit" || (i.mode === "text" && model.capabilities.documents));
  if (limited.length > 0) {
    notices.push({
      code: "ATTACHMENTS_LIMITED",
      message: `A request can include 5 documents and 20 images, so older files were sent as text or left out: ${limited.map((i) => i.att.name).join(", ")}.`,
    });
  }

  const result: ResolvedAttachments = { current: [], byMessage: new Map(), notices, textFiles: [] };
  const loadedBy = new Map<Item, LoadedAttachment>();
  const texts: { item: Item; text: string }[] = [];

  await Promise.all(
    items.map(async (item) => {
      if (item.mode === "skip-limit" || item.mode === "skip") return;
      try {
        if (item.mode === "bytes") {
          const loaded = await loadBytes(store, item);
          if (!loaded) return void expire(item);
          loadedBy.set(item, { name: item.att.name, kind: loaded.kind, bytes: loaded.bytes });
        } else {
          const text = await loadText(store, item);
          if (text === undefined) return void expire(item);
          texts.push({ item, text });
        }
      } catch (err) {
        if (item.messageId === undefined) throw err; // the new turn must be valid
        console.error(JSON.stringify({ level: "error", message: "earlier attachment skipped", name: item.att.name, error: String(err) }));
      }
    }),
  );

  // Total payload budget: current turn first, then the newest history. Over it, documents go as text and images are dropped.
  const overBudget: string[] = [];
  const priority = [...items.filter((i) => i.messageId === undefined), ...items.filter((i) => i.messageId !== undefined).reverse()];
  let total = 0;
  for (const item of priority) {
    const loaded = loadedBy.get(item);
    if (!loaded || loaded.text !== undefined) continue;
    if (total + loaded.bytes.length <= MAX_REQUEST_ATTACHMENT_BYTES) {
      total += loaded.bytes.length;
      continue;
    }
    loadedBy.delete(item);
    overBudget.push(item.att.name);
    if (item.kind.kind !== "document") continue;
    try {
      const text = await extractAndCache(store, item, { bytes: loaded.bytes, kind: item.kind });
      if (text !== undefined) texts.push({ item, text });
    } catch (err) {
      if (item.messageId === undefined) throw err;
      console.error(JSON.stringify({ level: "error", message: "over-budget attachment skipped", name: item.att.name, error: String(err) }));
    }
  }
  if (overBudget.length > 0) {
    notices.push({
      code: "ATTACHMENTS_LIMITED",
      message: `Attachments are limited to ${MAX_REQUEST_ATTACHMENT_BYTES / 1_000_000} MB per request, so these were sent as text or left out: ${overBudget.join(", ")}.`,
    });
  }

  function expire(item: Item) {
    if (item.messageId === undefined) throw badRequest(`${item.att.name}: the upload was not found. Attach it again.`);
    notices.push({ code: "ATTACHMENT_EXPIRED", message: `${item.att.name} is no longer available (uploads are kept for 30 days).` });
  }

  const share = texts.length > 0 ? Math.floor(textBudgetChars(model) / texts.length) : 0;
  for (const { item, text } of texts) {
    const used = text.slice(0, share);
    if (used.length < text.length) {
      notices.push({
        code: "ATTACHMENT_TRUNCATED",
        message: `${item.att.name}: only the first ${used.length.toLocaleString("en-US")} of ${text.length.toLocaleString("en-US")} characters were included because of the model's size limit.`,
      });
    }
    loadedBy.set(item, { name: item.att.name, kind: item.kind, bytes: new Uint8Array(0), text: used });
  }
  // Rebuild in conversation order, whatever order the parallel loads finished in.
  for (const item of items) {
    const loaded = loadedBy.get(item);
    if (!loaded) continue;
    if (item.messageId === undefined) {
      result.current.push(loaded);
      if (loaded.text !== undefined && !model.capabilities.documents) result.textFiles.push(item.att.name);
    } else {
      result.byMessage.set(item.messageId, [...(result.byMessage.get(item.messageId) ?? []), loaded]);
    }
  }
  return result;
}
