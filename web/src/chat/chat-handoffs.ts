import { createHandoffStore } from './chat-handoff'
import type { UiMessage } from './messages'

export interface ChatHandoff {
  messages: UiMessage[]
  modelId: string
  workspaceId: string
  title?: string
}

export const chatHandoffs = createHandoffStore<ChatHandoff>()
