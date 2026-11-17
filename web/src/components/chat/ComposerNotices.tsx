import type { AttachWarning } from '../../chat/attach-rules'
import { Button, InlineNotice } from '../ui'

interface ComposerNoticesProps {
  warnings: AttachWarning[]
  // Files that were refused when attached, with the reason for each.
  problems: string[]
  onFix?: () => void
  onDismissProblems: () => void
  // The prompt is over the length cap.
  lengthProblem: string | null
}

// Everything the person should know before pressing Send. Blocking problems say so and offer the fix.
export function ComposerNotices({ warnings, problems, onFix, onDismissProblems, lengthProblem }: ComposerNoticesProps) {
  return (
    <div className="grid gap-2 empty:hidden">
      {warnings.map((warning) => (
        <InlineNotice
          key={warning.message}
          tone={warning.tone === 'bad' ? 'bad' : 'info'}
          actions={
            warning.fix && onFix ? (
              <Button size="sm" variant="secondary" onPress={onFix}>
                {warning.fix.label}
              </Button>
            ) : undefined
          }
        >
          {warning.message}
        </InlineNotice>
      ))}
      {lengthProblem && <InlineNotice tone="bad">{lengthProblem}</InlineNotice>}
      {problems.length > 0 && (
        <InlineNotice
          tone="bad"
          actions={
            <Button size="sm" onPress={onDismissProblems}>
              Dismiss
            </Button>
          }
        >
          <ul className="grid gap-1">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </InlineNotice>
      )}
    </div>
  )
}
