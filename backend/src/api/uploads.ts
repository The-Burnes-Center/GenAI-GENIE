import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { s3 } from "../lib/aws.js";
import { getConfig } from "../lib/config.js";
import { assertSafeFileName, classifyFile, MAX_ATTACHMENT_DOC_BYTES, MAX_IMAGE_BYTES, MAX_WORKSPACE_DOC_BYTES, safeFileName } from "../lib/files.js";
import { putItem } from "../lib/db.js";
import { badRequest, ok } from "../lib/http.js";
import { attachmentPrefix, UPLOAD_TTL_SECONDS } from "../lib/limits.js";
import type { UploadResponse } from "../lib/api-types.js";
import { parseJsonBody, uploadRequestSchema } from "../lib/schemas.js";
import { requireManageable } from "../lib/workspaces.js";
import { route } from "./router.js";

const PRESIGN_SECONDS = 300;
const mb = (bytes: number) => `${bytes / 1_000_000} MB`;

export const uploadRoutes = [
  route("POST", "/api/uploads", async ({ user, rawBody }) => {
    const input = parseJsonBody(uploadRequestSchema, rawBody);
    assertSafeFileName(input.fileName);
    const kind = classifyFile(input.contentType, input.fileName);
    if (!kind) throw badRequest("This file type is not supported");
    const fileName = safeFileName(input.fileName);

    let key: string;
    if (input.purpose === "attachment") {
      const limit = kind.kind === "image" ? MAX_IMAGE_BYTES : MAX_ATTACHMENT_DOC_BYTES;
      if (input.size > limit) throw badRequest(`${kind.kind === "image" ? "Images" : "Documents"} can be up to ${mb(limit)} in chat`);
      key = `${attachmentPrefix(user.sub)}${randomUUID()}/${fileName}`;
    } else {
      if (!input.workspaceId) throw badRequest("workspaceId is required for workspace uploads");
      if (kind.kind !== "document") throw badRequest("Workspaces accept documents, not images");
      if (input.size > MAX_WORKSPACE_DOC_BYTES) throw badRequest(`Workspace documents can be up to ${mb(MAX_WORKSPACE_DOC_BYTES)}`);
      await requireManageable(user, input.workspaceId);
      // Users never write under `workspaces/` (the Knowledge Base reads it, sidecars included).
      // Uploads land in a one-day staging area; the server copies them in on registration.
      const uploadId = randomUUID();
      key = `staging/${user.sub}/${uploadId}`;
      await putItem({
        PK: `UPLOAD#${user.sub}`,
        SK: uploadId,
        key,
        workspaceId: input.workspaceId,
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size,
        createdAt: new Date().toISOString(),
        expiresAt: Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS,
      });
    }

    const contentType = input.contentType || kind.contentType;
    const uploadUrl = await getSignedUrl(
      s3(),
      new PutObjectCommand({ Bucket: getConfig().uploadsBucket, Key: key, ContentType: contentType, ContentLength: input.size }),
      { expiresIn: PRESIGN_SECONDS },
    );
    return ok<UploadResponse>({ key, uploadUrl, headers: { "Content-Type": contentType } });
  }),
];
