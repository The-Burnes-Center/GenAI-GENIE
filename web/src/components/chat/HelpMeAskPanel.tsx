import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { RewriteResponse } from '../../api/types'
import { describeAssistFailure } from '../../chat/assist-state'
import { countPlaceholders } from '../../chat/placeholders'
import type { useHelpMeAsk } from '../../chat/use-help-me-ask'
import { Button, InlineNotice, Spinner, TextField } from '../ui'
import { HighlightedText } from './HighlightedText'

interface HelpMeAskPanelProps {
  help: ReturnType<typeof useHelpMeAsk>
  // Lets the message box's button focus the panel when it is already open.
  panelRef: RefObject<HTMLElement | null>
  // Puts the chosen text in the message box.
  onUse: (text: string) => void
  // Closes the panel and returns to the person's own text.
  onKeepMine: () => void
}

// Shows the suggestion, what was added, and three choices: use it, edit it first, or keep your own.
export function HelpMeAskPanel({ help, panelRef, onUse, onKeepMine }: HelpMeAskPanelProps) {
  const { state, result, error } = help

  // Opening, and the result arriving, can leave the buttons below the fold. Bring the panel into view.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    panelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [state, panelRef])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onKeepMine()
  }

  return (
    <section ref={panelRef} tabIndex={-1} aria-label="Help me ask" data-help-me-ask="" onKeyDown={onKeyDown} className="animate-rise grid gap-3 rounded-lg border border-edge bg-canvas p-3 outline-none">
      <p className="vh" role="status">
        {state === 'loading' ? 'Writing a clearer version.' : state === 'ready' ? 'A clearer version is ready.' : ''}
      </p>
      {state === 'loading' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="flex items-center gap-2 text-ink-2" aria-hidden="true">
            <Spinner />
            Writing a clearer version of your request
          </p>
          <Button size="sm" className="pointer-coarse:min-h-11!" onPress={onKeepMine}>Cancel</Button>
        </div>
      )}
      {state === 'error' && <AssistError error={error} onRetry={help.retry} onKeepMine={onKeepMine} />}
      {state === 'ready' && result && <Suggestion key={result.text} result={result} onUse={onUse} onKeepMine={onKeepMine} />}
    </section>
  )
}

interface SuggestionProps {
  result: RewriteResponse
  onUse: (text: string) => void
  onKeepMine: () => void
}

function Suggestion({ result, onUse, onKeepMine }: SuggestionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [edited, setEdited] = useState(result.text)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const text = isEditing ? edited : result.text

  // When the answer arrives, move to its heading so a screen reader hears it. Only if the person is still here.
  useEffect(() => {
    const active = document.activeElement
    if (!active || active === document.body || active.closest('[data-help-me-ask]') || active.closest('form[aria-label="Message composer"]')) {
      headingRef.current?.focus()
    }
  }, [])

  return (
    <>
      <h2 ref={headingRef} tabIndex={-1} className="text-ui font-semibold">A clearer version</h2>
      {isEditing ? (
        <TextField label="Edit the suggested version" multiline rows={6} value={edited} onChange={setEdited} />
      ) : (
        <p className="whitespace-pre-wrap rounded-md border border-edge bg-surface px-3 py-2.5 text-body [overflow-wrap:anywhere]">
          <HighlightedText text={result.text} />
        </p>
      )}
      {countPlaceholders(text) > 0 && (
        <p className="text-small text-ink-2">
          The <mark className="rounded-xs bg-warm-soft px-0.5 text-warm-soft-ink">[bracketed]</mark> parts are blanks. Fill them in after you use this version.
        </p>
      )}
      <div className="grid gap-1">
        <h3 className="text-small font-semibold text-ink-2">What I added</h3>
        {result.changes.length > 0 ? (
          <ul className="list-disc pl-5 text-ink-2">
            {result.changes.map((change) => <li key={change}>{change}</li>)}
          </ul>
        ) : (
          <p className="text-ink-2">Nothing. Your request was already clear, so I only made small fixes.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" isDisabled={text.trim() === ''} onPress={() => onUse(text.trim())}>Use this version</Button>
        <Button onPress={() => setIsEditing((on) => !on)}>{isEditing ? 'Done editing' : 'Edit it first'}</Button>
        <Button variant="ghost" onPress={onKeepMine}>Keep mine</Button>
      </div>
    </>
  )
}

function AssistError({ error, onRetry, onKeepMine }: { error: unknown; onRetry: () => void; onKeepMine: () => void }) {
  const failure = describeAssistFailure(error)
  return (
    <InlineNotice
      tone={failure.kind === 'limit' ? 'warn' : 'bad'}
      actions={
        <>
          {failure.canRetry && <Button size="sm" className="pointer-coarse:min-h-11!" onPress={onRetry}>Try again</Button>}
          <Button size="sm" variant="ghost" className="pointer-coarse:min-h-11!" onPress={onKeepMine}>Keep mine</Button>
        </>
      }
    >
      {failure.message}
    </InlineNotice>
  )
}
