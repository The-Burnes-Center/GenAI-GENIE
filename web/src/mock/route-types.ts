import type { HttpMethod } from './router'
import type { MockIdentity } from './identity'

// public: no token. signedIn: any valid token (also pending accounts). approved: active accounts only. admin: admin group.
export type RouteAccess = 'public' | 'signedIn' | 'approved' | 'admin'

export interface RouteContext {
  request: Request
  url: URL
  params: Record<string, string>
  identity: MockIdentity
}

export interface MockRoute {
  method: HttpMethod
  path: string
  access: RouteAccess
  handle: (context: RouteContext) => Response | Promise<Response>
}
