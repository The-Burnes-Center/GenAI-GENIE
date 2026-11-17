// Response helpers that match the REST contract: JSON bodies and { error: { code, message } } on failure.
import type { ErrorBody, ErrorCode, Page } from '../api/types'

export const PAGE_SIZE = 50

// Thrown by route handlers. The dispatcher turns it into the contract's error body.
export class MockHttpError extends Error {
  readonly status: number
  readonly code: ErrorCode

  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.name = 'MockHttpError'
    this.status = status
    this.code = code
  }
}

// Name the response type at the call site (json<SessionDetail>(...)) so the body is checked against the contract.
export function json<T = unknown>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function errorResponse(status: number, code: ErrorCode, message: string): Response {
  return json<ErrorBody>({ error: { code, message } }, status)
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new MockHttpError(400, 'BAD_REQUEST', 'That request was not valid.')
  }
}

// Cursors are opaque to the client. The mock uses the offset of the next item.
export function paginate<T>(items: T[], cursor: string | null, pageSize = PAGE_SIZE): Page<T> {
  const start = cursor ? Number(cursor) : 0
  const offset = Number.isInteger(start) && start >= 0 ? start : 0
  const end = offset + pageSize
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? String(end) : null,
  }
}

export function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MockHttpError(400, 'BAD_REQUEST', `Enter a ${field}.`)
  }
  return value.trim()
}
