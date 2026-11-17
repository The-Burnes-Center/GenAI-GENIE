// msw registration. The routes live in routes/ and are shared with the Node test server.
import { http } from 'msw'
import { runRoute, type HttpMethod } from './router'
import { ALL_ROUTES } from './routes'

const REGISTER: Record<HttpMethod, typeof http.get> = {
  GET: http.get,
  POST: http.post,
  PUT: http.put,
  PATCH: http.patch,
  DELETE: http.delete,
}

function asStrings(params: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
}

// One msw handler per route. setupWorker (browser) and setupServer (Node tests) both take this list.
export const mockHandlers = ALL_ROUTES.map((route) =>
  REGISTER[route.method](route.path, ({ request, params }) => runRoute(route, request, asStrings(params))),
)
