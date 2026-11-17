import type { Capabilities, UploadPurpose } from '../api/types'

export type { UploadPurpose }
export type FileKind = 'image' | 'spreadsheet' | 'document'

// Decimal megabytes, the stricter reading, so a client pass never admits a file the server rejects.
const MEGABYTE = 1_000_000
export const IMAGE_LIMIT_BYTES = 3.75 * MEGABYTE
export const ATTACHMENT_DOCUMENT_LIMIT_BYTES = 4.5 * MEGABYTE
export const WORKSPACE_DOCUMENT_LIMIT_BYTES = 50 * MEGABYTE

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

const SPREADSHEET_TYPES: Record<string, string> = {
  csv: 'text/csv',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html',
  txt: 'text/plain',
  md: 'text/markdown',
}

const TYPES_BY_KIND: Record<FileKind, Record<string, string>> = {
  image: IMAGE_TYPES,
  spreadsheet: SPREADSHEET_TYPES,
  document: DOCUMENT_TYPES,
}

export type ValidationResult = { ok: true; contentType: string } | { ok: false; message: string }

export interface UploadCandidate {
  name: string
  size: number
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

// Returns the kind of file for its extension, or null when the type is not accepted anywhere.
export function classifyFile(name: string): FileKind | null {
  const extension = extensionOf(name)
  if (IMAGE_TYPES[extension]) return 'image'
  if (SPREADSHEET_TYPES[extension]) return 'spreadsheet'
  if (DOCUMENT_TYPES[extension]) return 'document'
  return null
}

function formatMegabytes(bytes: number): string {
  return `${Number((bytes / MEGABYTE).toFixed(2))} MB`
}

// Chat attachments take images, spreadsheets and documents. Workspaces take spreadsheets and documents.
export function acceptAttribute(purpose: UploadPurpose): string {
  const kinds: FileKind[] = purpose === 'attachment' ? ['image', 'spreadsheet', 'document'] : ['spreadsheet', 'document']
  return kinds
    .flatMap((kind) => Object.keys(TYPES_BY_KIND[kind]))
    .map((ext) => `.${ext}`)
    .join(',')
}

function sizeLimit(kind: FileKind, purpose: UploadPurpose): number {
  if (kind === 'image') return IMAGE_LIMIT_BYTES
  return purpose === 'attachment' ? ATTACHMENT_DOCUMENT_LIMIT_BYTES : WORKSPACE_DOCUMENT_LIMIT_BYTES
}

// Capability checks mirror the server: images need vision, spreadsheets need documents.
// Other documents are always allowed because the server extracts their text for any model.
function capabilityProblem(kind: FileKind, purpose: UploadPurpose, capabilities?: Capabilities): string | null {
  if (kind === 'image' && purpose === 'workspace') return 'Workspaces accept documents, not images.'
  if (!capabilities) return null
  if (kind === 'image' && !capabilities.vision) return 'The selected model cannot read images.'
  if (kind === 'spreadsheet' && !capabilities.documents) return 'The selected model cannot read spreadsheets.'
  return null
}

export function validateUpload(
  file: UploadCandidate,
  purpose: UploadPurpose,
  capabilities?: Capabilities,
): ValidationResult {
  if (file.size <= 0) return { ok: false, message: `${file.name} is empty.` }

  const kind = classifyFile(file.name)
  if (!kind) return { ok: false, message: `${file.name} is not a supported file type.` }

  const problem = capabilityProblem(kind, purpose, capabilities)
  if (problem) return { ok: false, message: problem }

  const limit = sizeLimit(kind, purpose)
  if (file.size > limit) {
    return { ok: false, message: `${file.name} is larger than ${formatMegabytes(limit)}.` }
  }
  return { ok: true, contentType: TYPES_BY_KIND[kind][extensionOf(file.name)] }
}
