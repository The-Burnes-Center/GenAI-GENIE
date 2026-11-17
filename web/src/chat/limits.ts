import { classifyFile } from '../uploads/validation'

// Per-message limits from ARCHITECTURE.md (Converse limits and prompt size).
export const MAX_PROMPT_CHARS = 400_000
export const MAX_DOCUMENTS_PER_MESSAGE = 5
export const MAX_IMAGES_PER_MESSAGE = 20

export interface NamedFile {
  name: string
}

// Returns the first problem with a message, or null when it is within limits.
export function checkMessageLimits(prompt: string, files: NamedFile[]): string | null {
  if (prompt.length > MAX_PROMPT_CHARS) {
    return 'That message is too long. Attach it as a file instead.'
  }
  const kinds = files.map((file) => classifyFile(file.name))
  const images = kinds.filter((kind) => kind === 'image').length
  const documents = kinds.length - images
  if (documents > MAX_DOCUMENTS_PER_MESSAGE) {
    return `Attach up to ${MAX_DOCUMENTS_PER_MESSAGE} documents per message.`
  }
  if (images > MAX_IMAGES_PER_MESSAGE) {
    return `Attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.`
  }
  return null
}
