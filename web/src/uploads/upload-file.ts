import { requestUpload } from '../api/uploads'
import { putObject, type PutProgress } from './put-object'
import { validateUpload, type UploadPurpose } from './validation'
import type { AttachmentRef, Capabilities } from '../api/types'

export interface UploadOptions {
  capabilities?: Capabilities
  onProgress?: (progress: PutProgress) => void
  signal?: AbortSignal
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadValidationError'
  }
}

// Validates locally, requests a presigned PUT, then uploads the bytes straight to S3.
// Workspace documents still need registering with addWorkspaceDocument afterwards.
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  workspaceId?: string,
  options: UploadOptions = {},
): Promise<AttachmentRef> {
  const verdict = validateUpload(file, purpose, options.capabilities)
  if (!verdict.ok) throw new UploadValidationError(verdict.message)
  if (purpose === 'workspace' && !workspaceId) {
    throw new UploadValidationError('Choose a workspace before uploading.')
  }

  const ticket = await requestUpload({
    fileName: file.name,
    contentType: verdict.contentType,
    size: file.size,
    purpose,
    workspaceId,
  })
  await putObject(ticket.uploadUrl, ticket.headers, file, {
    onProgress: options.onProgress,
    signal: options.signal,
  })
  return { key: ticket.key, name: file.name, contentType: verdict.contentType, size: file.size }
}
