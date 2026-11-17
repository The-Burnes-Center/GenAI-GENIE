// Entry point for mock mode. main.tsx imports this only when VITE_MOCK is 1, so production builds never include it.
import { setTokenProvider } from '../auth/auth-service'
import { MOCK_TOKEN, readMockSignIn, setMockAsUser } from './identity'
import { mockTiming } from './timing'

const SLOW_THINKING_MS = 300
const SLOW_TOKEN_MS = 90

export const isMockMode = import.meta.env.VITE_MOCK === '1'

// ?asUser makes the mock user a non-admin for this tab. ?admin switches back.
function applyPageParameters(): void {
  const params = new URLSearchParams(window.location.search)
  if (params.has('asUser')) setMockAsUser(true)
  if (params.has('admin')) setMockAsUser(false)
  // ?slow stretches the stream so a screenshot can catch it mid-answer.
  if (params.has('slow')) {
    mockTiming.thinkingDelayMs = SLOW_THINKING_MS
    mockTiming.tokenDelayMs = SLOW_TOKEN_MS
  }
}

export async function startMock(): Promise<void> {
  applyPageParameters()
  setTokenProvider(async () => (readMockSignIn() ? MOCK_TOKEN : null))
  const { setupWorker } = await import('msw/browser')
  const { mockHandlers } = await import('./handlers')
  // Only /api and /config.json have handlers. Anything else (the app's own assets) passes through.
  await setupWorker(...mockHandlers).start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
}
