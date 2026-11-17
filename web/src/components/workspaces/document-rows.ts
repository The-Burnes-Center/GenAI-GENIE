import type { WorkspaceDocument } from '../../api/types'

// A document waiting in "uploaded" longer than this is treated as stuck and offers Retry.
export const STUCK_AFTER_MS = 5 * 60_000

export interface LocalUpload {
  id: string
  name: string
  size: number
  // 0 to 1 while bytes are going to storage.
  fraction: number
  // Set when the upload itself failed. The row offers Dismiss.
  error?: string
}

export type DocRow =
  | { kind: 'local'; id: string; upload: LocalUpload }
  | { kind: 'server'; id: string; doc: WorkspaceDocument }

// Local uploads sit above the server list so a new file shows up where the eye is.
export function buildDocRows(documents: WorkspaceDocument[], uploads: LocalUpload[]): DocRow[] {
  return [
    ...uploads.map((upload): DocRow => ({ kind: 'local', id: `local-${upload.id}`, upload })),
    ...documents.map((doc): DocRow => ({ kind: 'server', id: doc.docId, doc })),
  ]
}

export function canRetry(doc: WorkspaceDocument, now: number = Date.now()): boolean {
  if (doc.status === 'failed') return true
  return doc.status === 'uploaded' && now - Date.parse(doc.createdAt) > STUCK_AFTER_MS
}
