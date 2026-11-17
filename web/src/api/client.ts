import { getIdToken } from '../auth/auth-service'
import { ApiError, fallbackMessage, isErrorBody } from './errors'

export { ApiError } from './errors'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequest {
  method?: HttpMethod
  body?: unknown
  signal?: AbortSignal
}

type QueryValue = string | number | boolean | null | undefined

// Drops empty values so optional filters do not leak into the URL.
export function withQuery(path: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export function segment(value: string): string {
  return encodeURIComponent(value)
}

export async function authorizationHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken()
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', fallbackMessage(401))
  return { Authorization: `Bearer ${token}` }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const text = await response.text()
  try {
    const parsed: unknown = JSON.parse(text)
    if (isErrorBody(parsed)) {
      return new ApiError(response.status, parsed.error.code, parsed.error.message)
    }
  } catch {
    // Not JSON (for example a proxy error page): use the status fallback below.
  }
  return new ApiError(response.status, `HTTP_${response.status}`, fallbackMessage(response.status))
}

export async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(await authorizationHeaders()),
    Accept: 'application/json',
  }
  if (request.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(path, {
    method: request.method ?? 'GET',
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    signal: request.signal,
  })
  if (!response.ok) throw await toApiError(response)

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
