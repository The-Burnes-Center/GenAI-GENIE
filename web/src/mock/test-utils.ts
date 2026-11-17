import { MOCK_TOKEN } from './identity'
import { mockTiming } from './timing'
import { resetStore } from './store'
import { resetMockPasskeys } from './mock-auth-rules'

// Removes every delay and resets the in-memory store, so each test starts from the seed.
export function resetMockForTests(): void {
  mockTiming.authDelayMs = [0, 0]
  mockTiming.firstEventMs = 0
  mockTiming.tokenDelayMs = 0
  mockTiming.thinkingDelayMs = 0
  window.sessionStorage.clear()
  resetStore(Date.parse('2026-11-17T14:00:00.000Z'))
  resetMockPasskeys()
}

// Adds the bearer token the mock API requires on every route except the public ones.
export function withAuth(request: Request): Request {
  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${MOCK_TOKEN}`)
  return new Request(request, { headers })
}
