import type { Capabilities, ModelConfig } from '../api/types'
import { classifyFile, validateUpload } from '../uploads/validation'
import { MAX_DOCUMENTS_PER_MESSAGE, MAX_IMAGES_PER_MESSAGE } from './limits'

export const UNSUPPORTED_TYPES_HELP = 'Use PDF, Word, Excel, CSV, HTML, text, Markdown, or an image.'

interface NamedFile {
  name: string
  size: number
}

export interface ScreenResult<T extends NamedFile> {
  accepted: T[]
  problems: string[]
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

function isImage(file: NamedFile): boolean {
  return classifyFile(file.name) === 'image'
}

function countKinds(files: NamedFile[]): { images: number; documents: number } {
  const images = files.filter(isImage).length
  return { images, documents: files.length - images }
}

// Checks files against type, size and the per-message counts, ignoring what the model can read:
// that is shown as a warning with a fix, never as a silent drop. Returns what to keep and why the rest was refused.
export function screenNewFiles<T extends NamedFile>(existing: NamedFile[], incoming: T[]): ScreenResult<T> {
  const accepted: T[] = []
  const problems: string[] = []
  const counts = countKinds(existing)
  for (const file of incoming) {
    if (classifyFile(file.name) === null) {
      const extension = extensionOf(file.name)
      problems.push(`Genie can't read ${extension ? `${extension} files` : `${file.name}`}. ${UNSUPPORTED_TYPES_HELP}`)
      continue
    }
    const verdict = validateUpload(file, 'attachment')
    if (!verdict.ok) {
      problems.push(verdict.message)
      continue
    }
    const kind = isImage(file) ? 'images' : 'documents'
    const max = kind === 'images' ? MAX_IMAGES_PER_MESSAGE : MAX_DOCUMENTS_PER_MESSAGE
    if (counts[kind] >= max) {
      problems.push(`Attach up to ${max} ${kind} per message. ${file.name} was not added.`)
      continue
    }
    counts[kind] += 1
    accepted.push(file)
  }
  return { accepted, problems }
}

export type AttachFix = 'switch-model'

export interface AttachWarning {
  // bad blocks sending; info is only a heads-up.
  tone: 'bad' | 'info'
  message: string
  fix?: { kind: AttachFix; label: string }
}

const SPREADSHEET_EXTENSIONS = ['.xls', '.xlsx']
const CONVERTED_EXTENSIONS = ['.pdf', '.doc', '.docx']

// What the person should know before sending, given the selected model. Order: blocking first.
export function attachmentWarnings(
  files: NamedFile[],
  model: { label: string; capabilities: Pick<Capabilities, 'vision' | 'documents'> },
): AttachWarning[] {
  const warnings: AttachWarning[] = []
  const image = files.find(isImage)
  if (image && !model.capabilities.vision) {
    warnings.push({
      tone: 'bad',
      message: `${model.label} can't see images. ${image.name} won't be sent to it. Switch to a model that can, or remove the image.`,
      fix: { kind: 'switch-model', label: 'Switch to a model that can see images' },
    })
  }
  const sheet = files.find((file) => SPREADSHEET_EXTENSIONS.includes(extensionOf(file.name)))
  if (sheet && !model.capabilities.documents) {
    warnings.push({
      tone: 'bad',
      message: `${model.label} can't read spreadsheets. Save ${sheet.name} as a CSV file, or switch to a model that reads documents.`,
      fix: { kind: 'switch-model', label: 'Switch to a model that reads documents' },
    })
  }
  const converted = files.find((file) => CONVERTED_EXTENSIONS.includes(extensionOf(file.name)))
  if (converted && !model.capabilities.documents) {
    warnings.push({
      tone: 'info',
      message: `${model.label} reads documents as plain text. Tables, layout and pictures inside ${converted.name} may be lost.`,
    })
  }
  return warnings
}

export function hasBlockingWarning(warnings: AttachWarning[]): boolean {
  return warnings.some((warning) => warning.tone === 'bad')
}

// Models that can read every kind of file. Used by the one-click switch and the picker.
export function pickCapableModel(
  models: ModelConfig[],
  files: NamedFile[],
  currentId: string,
): ModelConfig | undefined {
  const needsImages = files.some(isImage)
  const candidates = models.filter(
    (model) => model.modelId !== currentId && (!needsImages || model.capabilities.vision) && model.capabilities.documents,
  )
  return candidates[0]
}

export function modelBlockedByFiles(model: ModelConfig, files: NamedFile[]): string | null {
  if (files.some(isImage) && !model.capabilities.vision) return 'Can’t see the image you attached'
  return null
}

// Compare sends the same files to every chosen model, so a problem for any one of them blocks sending.
// There is no single model to switch, so no one-click fix is offered.
export function warningsForModels(
  files: NamedFile[],
  models: { label: string; capabilities: Pick<Capabilities, 'vision' | 'documents'> }[],
): AttachWarning[] {
  const seen = new Set<string>()
  return models
    .flatMap((model) => attachmentWarnings(files, model))
    .filter((warning) => !seen.has(warning.message) && Boolean(seen.add(warning.message)))
    .map(({ tone, message }) => ({ tone, message }))
}
