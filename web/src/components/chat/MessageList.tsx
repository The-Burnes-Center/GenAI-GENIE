import type { ModelConfig, Rating } from '../../api/types'
import type { UiMessage } from '../../chat/messages'
import { AssistantTurn } from './AssistantTurn'
import { UserTurn } from './UserTurn'

interface MessageListProps {
  messages: UiMessage[]
  sessionId?: string
  models: ModelConfig[]
  dailyLimit?: number
  isStreaming: boolean
  onRetry: (assistantId: string) => void
  onChooseModel: (assistantId: string) => void
  onFeedback: (assistantId: string, rating: Rating) => void
}

// A reading column of turns. No bubbles for answers, no avatars. Retry shows on failed turns and the last answer.
export function MessageList({ messages, sessionId, models, dailyLimit, isStreaming, onRetry, onChooseModel, onFeedback }: MessageListProps) {
  if (messages.length === 0) return null
  const lastIndex = messages.length - 1
  return (
    <ol aria-label="Messages" className="list-none">
      {messages.map((message, index) => (
        <li key={message.id}>
          {message.role === 'user' ? (
            <UserTurn message={message} />
          ) : (
            <AssistantTurn
              message={message}
              sessionId={sessionId}
              models={models}
              dailyLimit={dailyLimit}
              isLast={index === lastIndex}
              onRetry={isStreaming || index !== lastIndex ? undefined : () => onRetry(message.id)}
              onChooseModel={() => onChooseModel(message.id)}
              onFeedback={(rating) => onFeedback(message.id, rating)}
            />
          )}
        </li>
      ))}
    </ol>
  )
}
