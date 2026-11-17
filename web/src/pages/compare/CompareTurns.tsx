import type { ModelConfig, Rating } from '../../api/types'
import type { CompareTurn } from '../../chat/compare-state'
import { CompareColumn } from '../../components/chat/CompareColumn'
import { FileChipList } from '../../components/chat/FileChips'
import { classifyFile } from '../../uploads/validation'

interface CompareTurnsProps {
  turns: CompareTurn[]
  models: ModelConfig[]
  sessionId?: string
  dailyLimit?: number
  columns: number
  isStreaming: boolean
  continuingId?: string
  onRetry: (turn: number, modelId: string) => void
  onContinue: (modelId: string) => void
  onFeedback: (id: string, rating: Rating) => void
}

// Each turn: the prompt once, then one column per model. Columns sit side by side and stack on phones.
export function CompareTurns({ turns, models, sessionId, dailyLimit, columns, isStreaming, continuingId, onRetry, onContinue, onFeedback }: CompareTurnsProps) {
  const lastTurn = turns.length - 1
  return (
    <ol aria-label="Comparison" className="grid list-none gap-6">
      {turns.map((entry, index) => (
        <li key={entry.turn} className="grid gap-3">
          <div className="grid justify-items-end gap-2">
            <p className="max-w-[min(85%,560px)] whitespace-pre-wrap rounded-lg bg-sunken px-3.5 py-2.5 [overflow-wrap:anywhere]">
              <span className="vh">You asked: </span>
              {entry.prompt.content}
            </p>
            <FileChipList
              align="end"
              label="Attached files"
              files={entry.prompt.attachments.map((file) => ({ id: file.key, name: file.name, size: file.size, isImage: classifyFile(file.name) === 'image' }))}
            />
          </div>
          <div
            className="grid items-start gap-4 min-[900px]:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
            style={{ '--cols': Math.max(columns, entry.answers.length) } as React.CSSProperties}
          >
            {entry.answers.map((answer) => (
              <CompareColumn
                key={answer.id}
                message={answer}
                model={models.find((model) => model.modelId === answer.modelId)}
                models={models}
                sessionId={sessionId}
                dailyLimit={dailyLimit}
                onRetry={index === lastTurn && !isStreaming && answer.modelId ? () => onRetry(entry.turn, answer.modelId ?? '') : undefined}
                onContinue={() => answer.modelId && onContinue(answer.modelId)}
                isContinuing={continuingId === answer.modelId}
                onFeedback={(rating) => onFeedback(answer.id, rating)}
              />
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}
