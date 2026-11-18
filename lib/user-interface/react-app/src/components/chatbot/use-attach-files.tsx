import { Storage } from "aws-amplify";
import { ChangeEvent, Dispatch, SetStateAction, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ATTACH_ACCEPT,
  DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  MAX_FILES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  getFileExtension,
  isImageName,
} from "./documents";
import { ChatBotConfiguration, FileStorageProvider, ImageFile } from "./types";

const MAX_DOCUMENT_MB = MAX_DOCUMENT_BYTES / 1_000_000;
const MAX_IMAGE_MB = MAX_IMAGE_BYTES / 1_000_000;

function validate(selected: File[], alreadyAttached: number): string | null {
  if (alreadyAttached + selected.length > MAX_FILES_PER_MESSAGE) {
    return `You can attach up to ${MAX_FILES_PER_MESSAGE} files to each message.`;
  }
  const problems = selected.flatMap((file) => {
    const isImage = isImageName(file.name);
    if (!isImage && !DOCUMENT_EXTENSIONS.includes(getFileExtension(file.name))) {
      return [`"${file.name}" is not a supported file type. Use a PDF, Word, Excel, CSV, text or image file.`];
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) return [`"${file.name}" is larger than ${MAX_IMAGE_MB} MB.`];
    if (!isImage && file.size > MAX_DOCUMENT_BYTES) return [`"${file.name}" is larger than ${MAX_DOCUMENT_MB} MB.`];
    return [];
  });
  return problems.length > 0 ? problems.join(" ") : null;
}

async function upload(file: File): Promise<ImageFile> {
  const extension = getFileExtension(file.name);
  const response = await Storage.put(`${uuidv4().split("-")[0]}.${extension}`, file, {
    contentType: file.type || "application/octet-stream",
  });
  return {
    key: response.key,
    provider: FileStorageProvider.S3,
    // Images preview from the local file; documents get a signed URL when the chat renders them
    url: isImageName(file.name) ? URL.createObjectURL(file) : "",
    name: file.name,
  };
}

// Attach opens the system file picker directly; chosen files upload and appear as chips in the composer.
export function useAttachFiles(
  configuration: ChatBotConfiguration,
  setConfiguration: Dispatch<SetStateAction<ChatBotConfiguration>>
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = ""; // so choosing the same file again still fires
    if (selected.length === 0) return;

    const problem = validate(selected, (configuration.files ?? []).length);
    setError(problem);
    if (problem) return;

    setUploading(true);
    try {
      const uploaded: ImageFile[] = [];
      for (const file of selected) uploaded.push(await upload(file));
      setConfiguration((previous) => ({ ...previous, files: [...(previous.files ?? []), ...uploaded] }));
    } catch (uploadError) {
      console.error("Error uploading file:", uploadError);
      setError("The upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ATTACH_ACCEPT}
      onChange={onChange}
      style={{ display: "none" }}
      aria-hidden="true"
      tabIndex={-1}
    />
  );

  return {
    openPicker: () => inputRef.current?.click(),
    fileInput,
    uploading,
    error,
    clearError: () => setError(null),
  };
}
