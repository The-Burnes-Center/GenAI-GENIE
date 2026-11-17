// The code is read as a plain string: a newer server may send one this client does not know.
export interface WireErrorBody {
  error: { code: string; message: string }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function isErrorBody(value: unknown): value is WireErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  if (typeof error !== 'object' || error === null) return false
  const { code, message } = error as Record<string, unknown>
  return typeof code === 'string' && typeof message === 'string'
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'That request was not valid.',
  401: 'Your session has expired. Sign in again.',
  403: 'You do not have access to that.',
  404: 'That item could not be found.',
  409: 'That conflicts with the current state. Refresh and try again.',
}

// Friendly text for the UI. Unexpected errors are logged in full.
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  console.error('Unexpected error', error)
  return 'Something went wrong. Try again.'
}

export function fallbackMessage(status: number): string {
  return FALLBACK_MESSAGES[status] ?? 'Something went wrong. Try again.'
}
