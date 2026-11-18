import { ImageFile } from "./types";

export const DOCUMENT_EXTENSIONS = [
  "pdf",
  "docx",
  "doc",
  "txt",
  "md",
  "csv",
  "xlsx",
  "xls",
  "html",
];
export const DOCUMENT_ACCEPT = DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",");
export const MAX_DOCUMENTS_PER_MESSAGE = 5;
// Converse limit per document. Matches MAX_DOCUMENT_BYTES in the image request handler.
export const MAX_DOCUMENT_BYTES = 4_500_000;

export function getFileExtension(fileName: string): string {
  return fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
}

// The backend decides document or image from the stored key's extension, so this does too
export function isDocumentFile(file: Pick<ImageFile, "key">): boolean {
  return DOCUMENT_EXTENSIONS.includes(getFileExtension(file.key));
}
