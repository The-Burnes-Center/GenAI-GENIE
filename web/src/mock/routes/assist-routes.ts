import type { RewriteResponse } from '../../api/types'
import { json, MockHttpError, readJson } from '../http'
import { mockRewrite } from '../rewrite'
import { mockTiming, sleep } from '../timing'
import { getStore } from '../store'
import type { MockRoute } from '../route-types'

const MAX_CHARS = 8000
const DAILY_REWRITES = 50

// Test hooks: text with "limit" gets the daily-cap error, text with "fail" gets a failed assist, "busy" gets throttled.
export const assistRoutes: MockRoute[] = [
  {
    method: 'POST',
    path: '/api/assist/rewrite',
    access: 'approved',
    handle: async ({ request }) => {
      const body = await readJson<{ text?: unknown }>(request)
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (text === '') throw new MockHttpError(400, 'BAD_REQUEST', 'Write the request you want help with first.')
      if (text.length > MAX_CHARS) throw new MockHttpError(400, 'BAD_REQUEST', 'That request is too long to rewrite. Shorten it or attach it as a file.')
      const store = getStore()
      if (/\blimit\b/i.test(text) || store.rewritesToday >= DAILY_REWRITES) {
        throw new MockHttpError(429, 'LIMIT_REACHED', `You can use this ${DAILY_REWRITES} times a day. It starts over tomorrow.`)
      }
      await sleep(mockTiming.assistDelayMs, request.signal)
      if (/\bbusy\b/i.test(text)) throw new MockHttpError(503, 'UNAVAILABLE', 'The assistant is busy right now. Try again in a moment.')
      if (/\bfail\b/i.test(text)) throw new MockHttpError(502, 'ASSIST_FAILED', 'The assistant could not rewrite this request. Try again, or edit it yourself.')
      store.rewritesToday += 1
      return json<RewriteResponse>(mockRewrite(text))
    },
  },
]
