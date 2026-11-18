import { ShieldCheck } from '@phosphor-icons/react'
import { CHECK_LABEL, CHECK_PROMPT, REFINEMENTS, REFINE_LABEL, verifyLine } from '../../chat/answer-helpers'
import { REFINE_TIP } from '../../chat/hints'
import { Button } from '../ui'

interface AnswerHelpersProps {
  // The answer text (or all the answers in a comparison), used to say what to check.
  text: string
  // "many" in Compare, where one follow-up goes to every model.
  scope?: 'one' | 'many'
  // Offline, at the daily limit, or the message box is closed.
  isDisabled?: boolean
  showTip: boolean
  onDismissTip: () => void
  // Sends the follow-up as the next message.
  onSend: (prompt: string) => void
}

const CHIP_CLASS = 'font-normal pointer-coarse:min-h-11!'

// Under the latest finished answer: one-tap changes, a "Check this answer" action, and a cue that names
// what in this answer to verify. Nothing here sends until the person presses a button.
export function AnswerHelpers({ text, scope = 'one', isDisabled = false, showTip, onDismissTip, onSend }: AnswerHelpersProps) {
  const isMany = scope === 'many'
  const target = isMany ? 'these answers' : 'this answer'
  return (
    <div role="group" aria-label={`Change or check ${target}`} className="animate-rise mt-3 grid gap-3">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p id={`refine-${scope}`} className="text-small font-medium text-ink-2">{isMany ? 'Change all the answers' : REFINE_LABEL}</p>
          {showTip && (
            <p className="flex items-center gap-2 text-small text-ink-3">
              {REFINE_TIP}
              <Button variant="link" className="text-small pointer-coarse:min-h-11 pointer-coarse:px-2" onPress={onDismissTip}>Got it</Button>
            </p>
          )}
        </div>
        <ul aria-labelledby={`refine-${scope}`} className="flex list-none flex-wrap gap-2">
          {REFINEMENTS.map((refinement) => (
            <li key={refinement.id}>
              <Button size="sm" className={CHIP_CLASS} isDisabled={isDisabled} onPress={() => onSend(refinement.prompt)}>
                {refinement.label}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-sunken px-3 py-2.5">
        <p className="flex min-w-0 flex-1 basis-60 items-start gap-2 text-small text-ink-2">
          <ShieldCheck size={18} aria-hidden="true" className="mt-px shrink-0" />
          <span>{verifyLine(text, scope === 'many' ? 'many' : 'one')}</span>
        </p>
        <Button size="sm" className="pointer-coarse:min-h-11!" isDisabled={isDisabled} onPress={() => onSend(CHECK_PROMPT)}>
          {CHECK_LABEL}
        </Button>
      </div>
    </div>
  )
}
