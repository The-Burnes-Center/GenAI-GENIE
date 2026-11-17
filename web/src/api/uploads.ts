import { apiFetch } from './client'
import type { UploadRequest, UploadTicket } from './types'

export type { UploadRequest, UploadTicket }

export function requestUpload(body: UploadRequest): Promise<UploadTicket> {
  return apiFetch<UploadTicket>('/api/uploads', { method: 'POST', body })
}
