import { Storage } from "aws-amplify";
import {
  ChangeEvent,
  ClipboardEvent,
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
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

export interface PendingFile {
  id: string;
  name: string;
}

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

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

// Files arrive three ways: the Attach button (system file picker), dropping them anywhere on
// the page, or pasting them into the message box. Each file shows as a chip while it uploads.
export function useAttachFiles(
  configuration: ChatBotConfiguration,
  setConfiguration: Dispatch<SetStateAction<ChatBotConfiguration>>
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = async (selected: File[]) => {
    if (selected.length === 0) return;
    const problem = validate(selected, (configuration.files ?? []).length + pending.length);
    setError(problem);
    if (problem) return;

    const queued = selected.map((file) => ({ id: uuidv4(), name: file.name, file }));
    setPending((previous) => [...previous, ...queued.map(({ id, name }) => ({ id, name }))]);
    for (const { id, file } of queued) {
      try {
        const uploaded = await upload(file);
        setConfiguration((previous) => ({ ...previous, files: [...(previous.files ?? []), uploaded] }));
      } catch (uploadError) {
        console.error("Error uploading file:", uploadError);
        setError(`"${file.name}" did not upload. Please try again.`);
      } finally {
        setPending((previous) => previous.filter((item) => item.id !== id));
      }
    }
  };

  // Window listeners outlive a render, so they call the latest addFiles through a ref
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;

  useEffect(() => {
    let depth = 0; // dragenter/dragleave fire for every child element crossed
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault(); // allows the drop instead of the browser opening the file
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      addFilesRef.current(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = ""; // so choosing the same file again still fires
    addFiles(selected);
  };

  // Pasting a copied file or screenshot attaches it; pasting text still types as usual
  const onPaste = (event: ClipboardEvent) => {
    const pasted = Array.from(event.clipboardData?.files ?? []);
    if (pasted.length === 0) return;
    event.preventDefault();
    addFiles(pasted);
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
    onPaste,
    pending,
    uploading: pending.length > 0,
    dragging,
    error,
    clearError: () => setError(null),
  };
}
