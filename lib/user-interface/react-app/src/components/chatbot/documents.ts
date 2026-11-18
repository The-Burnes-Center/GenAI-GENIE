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
