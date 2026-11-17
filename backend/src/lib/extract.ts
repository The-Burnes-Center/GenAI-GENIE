import type { DocumentFormat } from "@aws-sdk/client-bedrock-runtime";
import { TEXT_EXTRACTABLE } from "./files.js";
import { badRequest } from "./http.js";

const decoder = new TextDecoder("utf-8");

/** Hard ceiling on extracted characters, so a huge or hostile file cannot exhaust memory downstream. */
export const MAX_EXTRACT_CHARS = 1_500_000;
const EXTRACT_TIMEOUT_MS = 30_000;

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("extraction timed out")), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value;
}

export interface Extractors {
  pdf: (bytes: Uint8Array) => Promise<string>;
  docx: (bytes: Uint8Array) => Promise<string>;
}

const REAL: Extractors = { pdf: pdfText, docx: docxText };

/** Plain text of a document for models that cannot take document blocks. Spreadsheets and legacy .doc are refused. */
export async function extractDocumentText(
  format: DocumentFormat,
  name: string,
  bytes: Uint8Array,
  extractors: Extractors = REAL,
): Promise<string> {
  if (!TEXT_EXTRACTABLE.has(format)) {
    const what = format === "xls" || format === "xlsx" ? "Spreadsheets" : "This file type";
    throw badRequest(`${what} (${name}) can only be read by models that support documents. Choose Claude or Nova, or export it as CSV.`);
  }
  let text: string;
  try {
    if (format === "pdf") text = await withTimeout(extractors.pdf(bytes), EXTRACT_TIMEOUT_MS);
    else if (format === "docx") text = await withTimeout(extractors.docx(bytes), EXTRACT_TIMEOUT_MS);
    else if (format === "html") text = htmlToText(decoder.decode(bytes));
    else text = decoder.decode(bytes);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", message: "text extraction failed", name, error: String(err) }));
    throw badRequest(`${name}: the text could not be read from this file.`);
  }
  const trimmed = text.slice(0, MAX_EXTRACT_CHARS).trim();
  if (!trimmed) throw badRequest(`${name}: no readable text was found (scanned files need a model that supports documents).`);
  return trimmed;
}

/** Labelled, fenced block so the model can tell file content from the user's own words. */
export function inlineTextBlock(name: string, text: string): string {
  const fence = text.includes("```") ? "~~~~" : "```";
  return `[Attached file: ${name}]\n${fence}\n${text}\n${fence}`;
}
