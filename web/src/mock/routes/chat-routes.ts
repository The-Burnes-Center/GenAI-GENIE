import { parseChatBody } from '../chat-body'
import { chatStreamResponse } from '../chat-stream'
import { readJson } from '../http'
import type { MockRoute } from '../route-types'

export const chatRoutes: MockRoute[] = [
  {
    method: 'POST',
    path: '/api/chat',
    access: 'approved',
    handle: async ({ request }) => {
      const body = parseChatBody(await readJson<unknown>(request))
      return chatStreamResponse(body, request.signal)
    },
  },
]
