import type {
  DocumentInput,
  DocumentResponse,
  Page,
  UploadRequest,
  UploadTicket,
  Workspace,
  WorkspaceDetail,
  WorkspaceDocument,
  WorkspaceInput,
  WorkspacePatch,
  WorkspaceResponse,
  WorkspaceVisibility,
} from '../../api/types'
import type { MockIdentity } from '../identity'
import { json, noContent, MockHttpError, paginate, readJson, requireText } from '../http'
import { getStore, nextId } from '../store'
import type { MockRoute } from '../route-types'

// Simulated ingestion: a new or retried document turns ready after this many milliseconds.
export const INDEXING_MS = 6_000
const WORKSPACE_LIMIT_BYTES = 50_000_000
const DOCUMENT_LIMIT_BYTES = 4_500_000
const IMAGE_LIMIT_BYTES = 3_750_000
const UPLOAD_EXPIRES_SECONDS = 300

function canSee(workspace: Workspace, identity: MockIdentity): boolean {
  return workspace.visibility === 'shared' || workspace.ownerEmail === identity.email
}

function canManage(workspace: Workspace, identity: MockIdentity): boolean {
  return identity.isAdmin || workspace.ownerEmail === identity.email
}

function visibleWorkspace(id: string, identity: MockIdentity): Workspace {
  const workspace = getStore().workspaces.find((item) => item.workspaceId === id && canSee(item, identity))
  if (!workspace) throw new MockHttpError(404, 'NOT_FOUND', 'That workspace could not be found.')
  return workspace
}

function manageableWorkspace(id: string, identity: MockIdentity): Workspace {
  const workspace = visibleWorkspace(id, identity)
  if (!canManage(workspace, identity)) throw new MockHttpError(403, 'FORBIDDEN', 'Only the owner or an admin can change this workspace.')
  return workspace
}

// Moves finished indexing jobs to ready. Called on every read, the way the real status refresh works.
function documentsFor(workspaceId: string): WorkspaceDocument[] {
  const store = getStore()
  const now = Date.now()
  const documents = store.documents[workspaceId] ?? []
  for (const document of documents) {
    const until = store.indexingUntil[document.docId]
    if (document.status === 'indexing' && until !== undefined && until <= now) document.status = 'ready'
  }
  return documents
}

function syncCount(workspace: Workspace): void {
  workspace.docCount = (getStore().documents[workspace.workspaceId] ?? []).length
}

function workspaceDetail(workspace: Workspace): WorkspaceDetail {
  syncCount(workspace)
  return { workspace, documents: documentsFor(workspace.workspaceId) }
}

function uploadKey(purpose: string, workspaceId: string | undefined, identity: MockIdentity, fileName: string): string {
  const token = nextId('u')
  return purpose === 'workspace' && workspaceId
    ? `workspaces/${workspaceId}/${token}/${fileName}`
    : `attachments/${identity.sub}/${token}/${fileName}`
}

function uploadLimit(contentType: string, purpose: string): number {
  if (purpose === 'workspace') return WORKSPACE_LIMIT_BYTES
  return contentType.startsWith('image/') ? IMAGE_LIMIT_BYTES : DOCUMENT_LIMIT_BYTES
}

async function requestUpload(request: Request, identity: MockIdentity): Promise<Response> {
  const body = await readJson<Partial<Record<keyof UploadRequest, unknown>>>(request)
  const fileName = requireText(body.fileName, 'file name')
  const contentType = typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream'
  const purpose = body.purpose === 'workspace' ? 'workspace' : 'attachment'
  const size = typeof body.size === 'number' ? body.size : 0
  if (size <= 0 || size > uploadLimit(contentType, purpose)) {
    throw new MockHttpError(400, 'BAD_REQUEST', 'That file is too large for this upload.')
  }
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : undefined
  const key = uploadKey(purpose, workspaceId, identity, fileName)
  return json<UploadTicket>({
    key,
    uploadUrl: `/mock-s3/${encodeURIComponent(key)}?X-Amz-Expires=${UPLOAD_EXPIRES_SECONDS}`,
    headers: { 'Content-Type': contentType },
  })
}

async function addDocument(workspace: Workspace, request: Request): Promise<Response> {
  const body = await readJson<Partial<Record<keyof DocumentInput, unknown>>>(request)
  const docId = nextId('d')
  const document: WorkspaceDocument = {
    docId,
    workspaceId: workspace.workspaceId,
    name: requireText(body.name, 'file name'),
    contentType: typeof body.contentType === 'string' ? body.contentType : 'application/octet-stream',
    size: typeof body.size === 'number' ? body.size : 0,
    s3Key: typeof body.key === 'string' ? body.key : `workspaces/${workspace.workspaceId}/${docId}/source`,
    status: 'indexing',
    createdAt: new Date().toISOString(),
  }
  const store = getStore()
  store.documents[workspace.workspaceId] = [...(store.documents[workspace.workspaceId] ?? []), document]
  store.indexingUntil[document.docId] = Date.now() + INDEXING_MS
  syncCount(workspace)
  return json<DocumentResponse>({ document }, 201)
}

function retryDocument(workspaceId: string, documentId: string, identity: MockIdentity): Response {
  const workspace = manageableWorkspace(workspaceId, identity)
  const document = documentsFor(workspace.workspaceId).find((item) => item.docId === documentId)
  if (!document) throw new MockHttpError(404, 'NOT_FOUND', 'That document could not be found.')
  if (document.status !== 'failed' && document.status !== 'uploaded') {
    throw new MockHttpError(409, 'CONFLICT', 'This document does not need a retry.')
  }
  document.status = 'indexing'
  delete document.error
  getStore().indexingUntil[document.docId] = Date.now() + INDEXING_MS
  return json<DocumentResponse>({ document })
}

async function createWorkspace(request: Request, identity: MockIdentity): Promise<Response> {
  const body = await readJson<Partial<Record<keyof WorkspaceInput, unknown>>>(request)
  const visibility: WorkspaceVisibility = body.visibility === 'shared' ? 'shared' : 'personal'
  if (visibility === 'shared' && !identity.isAdmin) {
    throw new MockHttpError(403, 'FORBIDDEN', 'Only admins can create shared workspaces.')
  }
  const workspace: Workspace = {
    workspaceId: nextId('w'),
    name: requireText(body.name, 'name'),
    description: typeof body.description === 'string' ? body.description.trim() : '',
    visibility,
    ownerSub: identity.sub,
    ownerEmail: identity.email,
    createdAt: new Date().toISOString(),
    docCount: 0,
  }
  getStore().workspaces.unshift(workspace)
  getStore().documents[workspace.workspaceId] = []
  return json<WorkspaceResponse>({ workspace }, 201)
}

export const workspaceRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/api/workspaces',
    access: 'approved',
    handle: ({ url, identity }) => {
      const visible = getStore().workspaces.filter((workspace) => canSee(workspace, identity)).map((workspace) => {
        syncCount(workspace)
        return workspace
      })
      return json<Page<Workspace>>(paginate(visible, url.searchParams.get('cursor')))
    },
  },
  { method: 'POST', path: '/api/workspaces', access: 'approved', handle: ({ request, identity }) => createWorkspace(request, identity) },
  {
    method: 'GET',
    path: '/api/workspaces/:id',
    access: 'approved',
    handle: ({ params, identity }) => json<WorkspaceDetail>(workspaceDetail(visibleWorkspace(params.id, identity))),
  },
  {
    method: 'PATCH',
    path: '/api/workspaces/:id',
    access: 'approved',
    handle: async ({ params, request, identity }) => {
      const body = await readJson<Partial<Record<keyof WorkspacePatch, unknown>>>(request)
      const workspace = manageableWorkspace(params.id, identity)
      if (typeof body.name === 'string') workspace.name = requireText(body.name, 'name')
      if (typeof body.description === 'string') workspace.description = body.description.trim()
      return json<WorkspaceResponse>({ workspace })
    },
  },
  {
    method: 'DELETE',
    path: '/api/workspaces/:id',
    access: 'approved',
    handle: ({ params, identity }) => {
      const workspace = manageableWorkspace(params.id, identity)
      const store = getStore()
      store.workspaces.splice(store.workspaces.indexOf(workspace), 1)
      delete store.documents[workspace.workspaceId]
      return noContent()
    },
  },
  {
    method: 'POST',
    path: '/api/workspaces/:id/documents',
    access: 'approved',
    handle: ({ params, request, identity }) => addDocument(manageableWorkspace(params.id, identity), request),
  },
  {
    method: 'DELETE',
    path: '/api/workspaces/:id/documents/:docId',
    access: 'approved',
    handle: ({ params, identity }) => {
      const workspace = manageableWorkspace(params.id, identity)
      const store = getStore()
      store.documents[workspace.workspaceId] = (store.documents[workspace.workspaceId] ?? []).filter((item) => item.docId !== params.docId)
      syncCount(workspace)
      return noContent()
    },
  },
  {
    method: 'POST',
    path: '/api/workspaces/:id/documents/:docId/retry',
    access: 'approved',
    handle: ({ params, identity }) => retryDocument(params.id, params.docId, identity),
  },
  { method: 'POST', path: '/api/uploads', access: 'approved', handle: ({ request, identity }) => requestUpload(request, identity) },
]
