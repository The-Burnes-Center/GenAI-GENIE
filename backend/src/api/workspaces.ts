import { CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../lib/aws.js";
import { getConfig } from "../lib/config.js";
import { batchDelete, deleteItem, deleteItemIfExists, getItem, putItem, updateItem } from "../lib/db.js";
import { assertSafeFileName, classifyFile, MAX_WORKSPACE_DOC_BYTES, verifyKind } from "../lib/files.js";
import { badRequest, conflict, HttpError, forbidden, noContent, notFound, ok } from "../lib/http.js";
import { refreshDocStatuses, requestReindex, sidecarBody, sidecarKey, startIngestion } from "../lib/kb.js";
import type { DocumentResponse, WorkspaceDetailResponse, WorkspaceListResponse, WorkspaceResponse } from "../lib/api-types.js";
import { createWorkspaceSchema, parseJsonBody, registerDocumentSchema, updateWorkspaceSchema } from "../lib/schemas.js";
import { SNIFF_BYTES } from "../lib/limits.js";
import { newId } from "../lib/sessions.js";
import type { AuthUser, Workspace, WorkspaceDoc } from "../lib/types.js";
import { listDocs, listVisibleWorkspaces, requireManageable, requireReadable } from "../lib/workspaces.js";
import { route } from "./router.js";

const wsKey = (id: string) => `WS#${id}`;

async function deleteObjects(keys: string[]): Promise<void> {
  const all = keys.flatMap((k) => [k, sidecarKey(k)]);
  for (let i = 0; i < all.length; i += 1000) {
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: getConfig().uploadsBucket,
        Delete: { Objects: all.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

interface PendingUpload {
  key: string;
  workspaceId: string;
  fileName: string;
  contentType: string;
  size: number;
}

/** Mark a half-registered document failed and remove anything it copied under workspaces/. */
async function abandonDocument(workspaceId: string, docId: string, keys: string[], reason: string): Promise<void> {
  await deleteObjects(keys).catch((err) => console.error(JSON.stringify({ level: "error", message: "cleanup of copied objects failed", error: String(err) })));
  await updateItem(wsKey(workspaceId), `DOC#${docId}`, { set: { status: "failed", error: reason } }).catch(() => undefined);
}

/**
 * Turn a staged upload into a workspace document. The caller may only name a staging key it owns; the
 * server picks the final key and writes the sidecar itself. Order matters:
 * claim the pending record (no double registration) -> DOC item `uploading` -> HEAD (ETag) -> verify type ->
 * copy only if the ETag still matches (no content swap) -> sidecar -> delete staging -> `uploaded` -> ingest.
 * Any failure after the DOC item exists marks it `failed` and deletes what was copied.
 */
async function registerDocument(user: AuthUser, workspaceId: string, input: { key: string; name: string }): Promise<WorkspaceDoc> {
  assertSafeFileName(input.name);
  const prefix = `staging/${user.sub}/`;
  const uploadId = input.key.startsWith(prefix) ? input.key.slice(prefix.length) : "";
  if (!uploadId || uploadId.includes("/")) throw badRequest("Unknown upload. Upload the file again.");
  const pending = await getItem<PendingUpload>(`UPLOAD#${user.sub}`, uploadId);
  if (!pending || pending.key !== input.key || pending.workspaceId !== workspaceId) throw badRequest("Unknown upload. Upload the file again.");
  const kind = classifyFile(pending.contentType, pending.fileName);
  if (kind?.kind !== "document") throw badRequest("This file type is not supported");

  // Atomic claim: a second request for the same upload finds nothing and is refused.
  if (!(await deleteItemIfExists(`UPLOAD#${user.sub}`, uploadId))) throw badRequest("That upload was already added.");

  const { uploadsBucket } = getConfig();
  const docId = newId();
  const key = `workspaces/${workspaceId}/${docId}/source.${kind.format}`;
  const doc: WorkspaceDoc = {
    docId, workspaceId, name: input.name, contentType: kind.contentType, size: pending.size,
    s3Key: key, status: "uploading", createdAt: new Date().toISOString(),
  };
  await putItem({ PK: wsKey(workspaceId), SK: `DOC#${docId}`, ...doc });
  await updateItem("WORKSPACES", wsKey(workspaceId), { add: { docCount: 1 } });

  const copied: string[] = [];
  try {
    const head = await s3().send(new HeadObjectCommand({ Bucket: uploadsBucket, Key: input.key }));
    const size = head.ContentLength ?? 0;
    if (size > MAX_WORKSPACE_DOC_BYTES) throw badRequest("That file is too large");
    const first = await s3().send(new GetObjectCommand({ Bucket: uploadsBucket, Key: input.key, Range: `bytes=0-${SNIFF_BYTES - 1}`, IfMatch: head.ETag }));
    verifyKind(kind, (await first.Body?.transformToByteArray()) ?? new Uint8Array(0), pending.fileName);
    copied.push(key);
    await s3().send(
      new CopyObjectCommand({
        Bucket: uploadsBucket, Key: key, CopySource: `${uploadsBucket}/${input.key}`, CopySourceIfMatch: head.ETag,
        ContentType: kind.contentType, MetadataDirective: "REPLACE",
      }),
    );
    copied.push(sidecarKey(key));
    await s3().send(new PutObjectCommand({ Bucket: uploadsBucket, Key: sidecarKey(key), Body: sidecarBody(workspaceId), ContentType: "application/json" }));
    await s3().send(new DeleteObjectCommand({ Bucket: uploadsBucket, Key: input.key }));
    await updateItem(wsKey(workspaceId), `DOC#${docId}`, { set: { status: "uploaded", size } });
  } catch (err) {
    await abandonDocument(workspaceId, docId, copied, "The file could not be added. Upload it again.");
    if (err instanceof HttpError) throw err;
    console.error(JSON.stringify({ level: "error", message: "document registration failed", docId, error: String(err) }));
    throw badRequest("The file could not be added. Upload it again.");
  }

  // A running job means this document waits as `uploaded` and is picked up on the next status refresh.
  const registered = { ...doc, status: "uploaded" as const };
  const jobId = await startIngestion();
  if (!jobId) return registered;
  await updateItem(wsKey(workspaceId), `DOC#${docId}`, { set: { status: "indexing", ingestionJobId: jobId } });
  return { ...registered, status: "indexing", ingestionJobId: jobId };
}

export const workspaceRoutes = [
  route("GET", "/api/workspaces", async ({ user }) => ok<WorkspaceListResponse>({ items: await listVisibleWorkspaces(user), nextCursor: null })),

  route("POST", "/api/workspaces", async ({ user, rawBody }) => {
    const input = parseJsonBody(createWorkspaceSchema, rawBody);
    if (input.visibility === "shared" && !user.isAdmin) throw forbidden("Only administrators can create shared workspaces");
    const ws: Workspace = {
      workspaceId: newId(),
      ...input,
      ownerSub: user.sub,
      ownerEmail: user.email,
      createdAt: new Date().toISOString(),
      docCount: 0,
    };
    await putItem({ PK: "WORKSPACES", SK: wsKey(ws.workspaceId), ...ws });
    return { status: 201, body: { workspace: ws } satisfies WorkspaceResponse };
  }),

  route("GET", "/api/workspaces/{id}", async ({ user, params, requestId }) => {
    const ws = await requireReadable(user, params.id as string);
    let documents = await listDocs(ws.workspaceId);
    try {
      documents = await refreshDocStatuses(ws.workspaceId, documents);
    } catch (err) {
      // Status is best effort: show what is stored rather than failing the page.
      console.error(JSON.stringify({ level: "error", requestId, message: "status refresh failed", error: String(err) }));
    }
    return ok<WorkspaceDetailResponse>({ workspace: ws, documents });
  }),

  route("PATCH", "/api/workspaces/{id}", async ({ user, params, rawBody }) => {
    const input = parseJsonBody(updateWorkspaceSchema, rawBody);
    const ws = await requireManageable(user, params.id as string);
    const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    await updateItem("WORKSPACES", wsKey(ws.workspaceId), { set });
    return ok<WorkspaceResponse>({ workspace: { ...ws, ...set } });
  }),

  route("DELETE", "/api/workspaces/{id}", async ({ user, params }) => {
    const ws = await requireManageable(user, params.id as string);
    const docs = await listDocs(ws.workspaceId);
    await deleteObjects(docs.map((d) => d.s3Key));
    await batchDelete(docs.map((d) => ({ PK: wsKey(ws.workspaceId), SK: `DOC#${d.docId}` })));
    await deleteItem("WORKSPACES", wsKey(ws.workspaceId));
    if (docs.length > 0) await requestReindex();
    return noContent();
  }),

  route("POST", "/api/workspaces/{id}/documents", async ({ user, params, rawBody }) => {
    const input = parseJsonBody(registerDocumentSchema, rawBody);
    const ws = await requireManageable(user, params.id as string);
    return { status: 201, body: { document: await registerDocument(user, ws.workspaceId, input) } satisfies DocumentResponse };
  }),

  // Re-run indexing for a failed document, or one still waiting because a job was running.
  route("POST", "/api/workspaces/{id}/documents/{docId}/retry", async ({ user, params }) => {
    const ws = await requireManageable(user, params.id as string);
    const doc = await getItem<WorkspaceDoc>(wsKey(ws.workspaceId), `DOC#${params.docId}`);
    if (!doc) throw notFound("Document not found");
    if (doc.status !== "failed" && doc.status !== "uploaded") throw conflict("Only failed or waiting documents can be retried");
    await s3().send(
      new PutObjectCommand({ Bucket: getConfig().uploadsBucket, Key: sidecarKey(doc.s3Key), Body: sidecarBody(ws.workspaceId), ContentType: "application/json" }),
    );
    const jobId = await startIngestion();
    // A running job means the document waits as `uploaded`; the next status refresh starts a new job.
    const set = jobId ? { status: "indexing" as const, ingestionJobId: jobId } : { status: "uploaded" as const };
    await updateItem(wsKey(ws.workspaceId), `DOC#${doc.docId}`, { set, remove: ["error"] });
    const { error: _error, ...rest } = doc;
    return ok<DocumentResponse>({ document: { ...rest, ...set } });
  }),

  route("DELETE", "/api/workspaces/{id}/documents/{docId}", async ({ user, params }) => {
    const ws = await requireManageable(user, params.id as string);
    const doc = await getItem<WorkspaceDoc>(wsKey(ws.workspaceId), `DOC#${params.docId}`);
    if (!doc) throw notFound("Document not found");
    await deleteObjects([doc.s3Key]);
    await deleteItem(wsKey(ws.workspaceId), `DOC#${doc.docId}`);
    await updateItem("WORKSPACES", wsKey(ws.workspaceId), { add: { docCount: -1 } });
    await requestReindex();
    return noContent();
  }),
];
