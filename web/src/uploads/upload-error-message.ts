import { ApiError } from '../api/client'
import { describeError } from '../api/errors'
import { UploadValidationError } from './upload-file'

// Validation and API messages are already friendly. Anything else goes through describeError.
export function uploadErrorMessage(error: unknown): string {
  if (error instanceof UploadValidationError || error instanceof ApiError) return error.message
  if (error instanceof Error && error.message.startsWith('Upload failed')) return error.message
  return describeError(error)
}
