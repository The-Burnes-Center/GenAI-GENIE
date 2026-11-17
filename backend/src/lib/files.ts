import type { DocumentFormat, ImageFormat } from "@aws-sdk/client-bedrock-runtime";
import { badRequest } from "./http.js";
import { SNIFF_BYTES } from "./limits.js";

// Decimal bytes, matching the web client exactly.
export const MAX_IMAGE_BYTES = 3_750_000;
export const MAX_ATTACHMENT_DOC_BYTES = 4_500_000;
export const MAX_WORKSPACE_DOC_BYTES = 50_000_000;
export const MAX_DOCUMENTS_PER_MESSAGE = 5;
export const MAX_IMAGES_PER_MESSAGE = 20;

const IMAGE_TYPES: Record<string, ImageFormat> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
};

const DOCUMENT_TYPES: Record<string, DocumentFormat> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/html": "html",
  "text/plain": "txt",
  "text/markdown": "md",
};

const DOCUMENT_EXTENSIONS: Record<string, DocumentFormat> = {
  pdf: "pdf", csv: "csv", doc: "doc", docx: "docx", xls: "xls", xlsx: "xlsx", html: "html", txt: "txt", md: "md",
};

export type FileKind =
  | { kind: "image"; format: ImageFormat; contentType: string }
  | { kind: "document"; format: DocumentFormat; contentType: string };

/** Classify by content type, falling back to the extension (browsers leave .md blank or generic). */
export function classifyFile(contentType: string, fileName: string): FileKind | undefined {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  const image = IMAGE_TYPES[type];
  if (image) return { kind: "image", format: image, contentType: type };
  const doc = DOCUMENT_TYPES[type];
  if (doc) return { kind: "document", format: doc, contentType: type };
  if (type === "" || type === "application/octet-stream") {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const byExt = DOCUMENT_EXTENSIONS[ext];
    if (byExt) return { kind: "document", format: byExt, contentType: type || "application/octet-stream" };
  }
  return undefined;
}

/** Object-key safe file name: no path separators or control characters. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._ ()\[\]-]+/g, "_").replace(/^\.+/, "").trim();
  return (cleaned || "file").slice(0, 120);
}

/** Formats the server can turn into plain text for models that cannot take document blocks. */
export const TEXT_EXTRACTABLE: ReadonlySet<DocumentFormat> = new Set<DocumentFormat>(["pdf", "docx", "txt", "md", "csv", "html"]);

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => Buffer.from(b.subarray(from, to)).toString("latin1");

export type Sniffed = "png" | "jpeg" | "gif" | "webp" | "pdf" | "zip-docx" | "zip-xlsx" | "zip" | "ole" | "text" | "binary";

/** What the bytes actually are, whatever the client or S3 content type claims. */
export function sniffBytes(bytes: Uint8Array): Sniffed {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const head = ascii(bytes, 0, SNIFF_BYTES);
    if (head.includes("word/")) return "zip-docx";
    if (head.includes("xl/")) return "zip-xlsx";
    return "zip";
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return "ole";
  return bytes.subarray(0, 4096).includes(0) ? "binary" : "text";
}

const ALLOWED_SNIFFS: Record<string, Sniffed[]> = {
  png: ["png"], jpeg: ["jpeg"], gif: ["gif"], webp: ["webp"], pdf: ["pdf"],
  docx: ["zip-docx", "zip"], xlsx: ["zip-xlsx", "zip"], doc: ["ole"], xls: ["ole"],
  txt: ["text"], md: ["text"], csv: ["text"], html: ["text"],
};

/** Confirm the file's real content matches its declared kind; a mismatch is a 400 (never trust the client type). */
export function verifyKind(declared: FileKind, bytes: Uint8Array, name: string): FileKind {
  const sniffed = sniffBytes(bytes);
  if (!ALLOWED_SNIFFS[declared.format]?.includes(sniffed)) {
    throw badRequest(`${name}: the file contents do not match its type. Re-save it and try again.`);
  }
  return declared;
}

/** Display names ending in `.metadata.json` could be mistaken for Knowledge Base sidecars. */
export function assertSafeFileName(name: string): void {
  if (/\.metadata\.json$/i.test(name.trim())) throw badRequest("That file name is not allowed");
}
