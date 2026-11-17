import { ApiError, authorizationHeaders, toApiError } from '../api/client'
import { readNdjson } from './ndjson'
import { parseChatEventLine } from './events'
import type { ChatEvent, ChatRequestBody } from './types'

export interface StreamChatOptions {
  signal?: AbortSignal
  onEvent: (event: ChatEvent) => void
}

// Resolves when the server closes the stream. Abort through `signal`.
export async function streamChat(body: ChatRequestBody, options: StreamChatOptions): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      ...(await authorizationHeaders()),
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })
  if (!response.ok) throw await toApiError(response)
  if (!response.body) throw new ApiError(502, 'EMPTY_STREAM', 'The server sent no response.')

  await readNdjson(response.body, (line) => {
    const event = parseChatEventLine(line)
    if (event) options.onEvent(event)
  })
}
