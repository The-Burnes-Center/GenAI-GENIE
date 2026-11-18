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
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
export const ATTACH_ACCEPT = [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS]
  .map((ext) => `.${ext}`)
  .join(",");
export const MAX_FILES_PER_MESSAGE = 5;
// Converse limits. MAX_DOCUMENT_BYTES matches the image request handler.
export const MAX_DOCUMENT_BYTES = 4_500_000;
export const MAX_IMAGE_BYTES = 3_750_000;

export function getFileExtension(fileName: string): string {
  return fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
}

// The backend decides document or image from the stored key's extension, so this does too
export function isDocumentFile(file: Pick<ImageFile, "key">): boolean {
  return DOCUMENT_EXTENSIONS.includes(getFileExtension(file.key));
}

export function isImageName(fileName: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(fileName));
}

export type FileKind = "pdf" | "doc" | "sheet" | "text" | "web" | "image" | "other";

export interface FileTypeInfo {
  kind: FileKind; // picks the tile color
  badge: string; // short letters shown on the tile
  label: string; // plain-language type shown under the name
}

const FILE_TYPES: Record<string, FileTypeInfo> = {
  pdf: { kind: "pdf", badge: "PDF", label: "PDF" },
  doc: { kind: "doc", badge: "DOC", label: "Word document" },
  docx: { kind: "doc", badge: "DOC", label: "Word document" },
  xls: { kind: "sheet", badge: "XLS", label: "Spreadsheet" },
  xlsx: { kind: "sheet", badge: "XLS", label: "Spreadsheet" },
  csv: { kind: "sheet", badge: "CSV", label: "Spreadsheet" },
  txt: { kind: "text", badge: "TXT", label: "Text file" },
  md: { kind: "text", badge: "MD", label: "Markdown" },
  html: { kind: "web", badge: "HTML", label: "Web page" },
};

export function getFileTypeInfo(fileName: string): FileTypeInfo {
  const extension = getFileExtension(fileName);
  if (FILE_TYPES[extension]) return FILE_TYPES[extension];
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return { kind: "image", badge: extension.slice(0, 4).toUpperCase(), label: "Image" };
  }
  return { kind: "other", badge: "FILE", label: "File" };
}
