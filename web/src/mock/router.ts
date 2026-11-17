// Matches a request to a mock route, checks who may call it, and turns failures into the error contract.
import { ALL_ROUTES } from './routes'
import type { MockRoute, RouteAccess } from './route-types'
import { currentIdentity, MOCK_TOKEN, type MockIdentity } from './identity'
import { errorResponse, MockHttpError } from './http'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// ":name" matches one segment. A trailing "*" matches the rest of the path.
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  const params: Record<string, string> = {}
  for (let index = 0; index < patternParts.length; index += 1) {
    const part = patternParts[index]
    if (part === '*') return params
    const value = pathParts[index]
    if (value === undefined) return null
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(value)
    else if (part !== value) return null
  }
  return pathParts.length === patternParts.length ? params : null
}

function requireAccess(access: RouteAccess, request: Request, identity: MockIdentity): void {
  if (access === 'public') return
  if (request.headers.get('Authorization') !== `Bearer ${MOCK_TOKEN}`) {
    throw new MockHttpError(401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.')
  }
  if (access === 'signedIn') return
  if (identity.status === 'pending') throw new MockHttpError(403, 'PENDING_APPROVAL', 'Your account is waiting for approval.')
  if (identity.status === 'suspended') throw new MockHttpError(403, 'SUSPENDED', 'This account has been suspended.')
  if (access === 'admin' && !identity.isAdmin) throw new MockHttpError(403, 'FORBIDDEN', 'Admins only.')
}

export async function runRoute(route: MockRoute, request: Request, params: Record<string, string> = {}): Promise<Response> {
  try {
    const identity = currentIdentity()
    requireAccess(route.access, request, identity)
    return await route.handle({ request, url: new URL(request.url), params, identity })
  } catch (error) {
    if (error instanceof MockHttpError) return errorResponse(error.status, error.code, error.message)
    console.error('Mock API failed', error)
    return errorResponse(500, 'INTERNAL', 'Something went wrong. Try again.')
  }
}

// Used by tests and by any caller holding a plain Request (msw uses the route list directly).
export async function dispatchMockRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  for (const route of ALL_ROUTES) {
    if (route.method !== request.method) continue
    const params = matchPath(route.path, url.pathname)
    if (params) return runRoute(route, request, params)
  }
  return errorResponse(404, 'NOT_FOUND', 'That item could not be found.')
}

export type { RouteAccess }
