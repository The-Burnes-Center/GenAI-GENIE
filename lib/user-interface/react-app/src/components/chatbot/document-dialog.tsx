import {
  Box,
  Button,
  FileUpload,
  Form,
  FormField,
  Modal,
  SpaceBetween,
  Spinner,
} from "@cloudscape-design/components";
import { Storage } from "aws-amplify";
import { Dispatch, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_MESSAGE,
  getFileExtension,
  isDocumentFile,
} from "./documents";
import { ChatBotConfiguration, FileStorageProvider, ImageFile } from "./types";

export interface DocumentDialogProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  configuration: ChatBotConfiguration;
  setConfiguration: Dispatch<React.SetStateAction<ChatBotConfiguration>>;
}

const MAX_DOCUMENT_MB = MAX_DOCUMENT_BYTES / 1_000_000;

export default function DocumentDialog(props: DocumentDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const attachedDocumentCount = (props.configuration.files ?? []).filter(
    isDocumentFile
  ).length;

  const validateFiles = (selected: File[]): string | null => {
    if (selected.length === 0) return null;

    if (attachedDocumentCount + selected.length > MAX_DOCUMENTS_PER_MESSAGE) {
      return `You can attach up to ${MAX_DOCUMENTS_PER_MESSAGE} documents to each message.`;
    }

    const problems: string[] = [];
    selected.forEach((file) => {
      if (!DOCUMENT_EXTENSIONS.includes(getFileExtension(file.name))) {
        problems.push(`"${file.name}" is not a supported file type.`);
      } else if (file.size > MAX_DOCUMENT_BYTES) {
        problems.push(`"${file.name}" is larger than ${MAX_DOCUMENT_MB} MB.`);
      }
    });
    return problems.length > 0 ? problems.join(" ") : null;
  };

  const uploadDocument = async (file: File): Promise<ImageFile> => {
    const shortId = uuidv4().split("-")[0];
    const extension = getFileExtension(file.name);
    const response = await Storage.put(`${shortId}.${extension}`, file, {
      contentType: file.type || "application/octet-stream",
    });
    return {
      key: response.key,
      provider: FileStorageProvider.S3,
      // The signed URL is filled in when the chat renders the file
      url: "",
      name: file.name,
    };
  };

  const closeDialog = () => {
    setFiles([]);
    setErrorText(null);
    props.setVisible(false);
  };

  const saveDocuments = async () => {
    const error = validateFiles(files);
    if (error || files.length === 0) {
      setErrorText(error ?? "Choose at least one document.");
      return;
    }

    setLoading(true);
    try {
      const uploaded: ImageFile[] = [];
      for (const file of files) {
        uploaded.push(await uploadDocument(file));
      }
      props.setConfiguration((previous) => ({
        ...previous,
        files: [...(previous.files ?? []), ...uploaded],
      }));
      closeDialog();
    } catch (uploadError) {
      console.error("Error uploading document:", uploadError);
      setErrorText("The upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      closeAriaLabel="Close dialog"
      onDismiss={closeDialog}
      visible={props.visible}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <Button variant="link" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={loading || files.length === 0 || errorText !== null}
              onClick={saveDocuments}
            >
              Add
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Add documents to your message"
    >
      <Form>
        <SpaceBetween size="m">
          <FormField
            label="Upload from device"
            errorText={errorText}
            description={`Attach up to ${MAX_DOCUMENTS_PER_MESSAGE} documents to this message. Each file must be under ${MAX_DOCUMENT_MB} MB.`}
            constraintText="PDF, DOCX, DOC, TXT, MD, CSV, XLSX, XLS or HTML."
          >
            <FileUpload
              onChange={({ detail }) => {
                setFiles(detail.value);
                setErrorText(validateFiles(detail.value));
              }}
              value={files}
              accept={DOCUMENT_ACCEPT}
              i18nStrings={{
                uploadButtonText: (e) => (e ? "Choose files" : "Choose file"),
                dropzoneText: (e) =>
                  e ? "Drop files to upload" : "Drop file to upload",
                removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                limitShowFewer: "Show fewer files",
                limitShowMore: "Show more files",
                errorIconAriaLabel: "Error",
              }}
              multiple={true}
              tokenLimit={MAX_DOCUMENTS_PER_MESSAGE}
            />
          </FormField>
          {loading && (
            <div>
              <Spinner />
              <span style={{ marginLeft: "5px" }}>Adding documents...</span>
            </div>
          )}
        </SpaceBetween>
      </Form>
    </Modal>
  );
}
