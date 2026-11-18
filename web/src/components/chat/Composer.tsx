import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { ArrowUp, Books, Brain, FileText, Stop, X } from '@phosphor-icons/react'
import { ToggleButton } from 'react-aria-components'
import type { AttachmentRef } from '../../api/types'
import { hasBlockingWarning, type AttachWarning } from '../../chat/attach-rules'
import { checkMessageLimits } from '../../chat/limits'
import { countPlaceholders, selectNextPlaceholder } from '../../chat/placeholders'
import { useComposerAssist } from '../../chat/use-composer-assist'
import type { useAttachments } from '../../chat/use-attachments'
import { Button, IconButton, Tooltip, buttonClass, cx } from '../ui'
import { ComposerNotices } from './ComposerNotices'
import { FileChipList } from './FileChips'
import { HelpMeAskButton } from './HelpMeAskButton'
import { HelpMeAskPanel } from './HelpMeAskPanel'

const MAX_HEIGHT_PX = 220
const THINK_TOOLTIP = 'Slower, but better on tricky questions'

export interface ComposerProps {
  attachments: ReturnType<typeof useAttachments>
  warnings: AttachWarning[]
  onFix?: () => void
  isStreaming: boolean
  // Reason the box is closed, for example the daily limit. Shows as the placeholder and disables everything.
  closedReason?: string
  isOffline?: boolean
  initialPrompt?: string
  placeholder?: string
  sendLabel?: string
  onSend: (prompt: string, attachments: AttachmentRef[]) => void
  onStop: () => void
  textareaRef?: RefObject<HTMLTextAreaElement | null>
  // Template and workspace chips shown with the files.
  contextChips?: { label: string; icon: 'template' | 'workspace'; onRemove: () => void }[]
  // Tool buttons on the left (attach, workspace, think). Model picker and extras on the right.
  tools: ReactNode
  trailing?: ReactNode
  routeFocus?: boolean
  // Show "Help me ask". On by default.
  canAssist?: boolean
  // First character typed into an empty box, and the box losing focus.
  onDraftStart?: () => void
  onDraftBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void
  inputId: string
  label?: string
}

// The message box: autosizing textarea, chips, warnings, tools, and Send or Stop.
// Enter sends, Shift+Enter adds a line, Escape stops while it is writing.
export function Composer(props: ComposerProps) {
  const { attachments, warnings, isStreaming, closedReason, isOffline, initialPrompt = '', onSend, onStop } = props
  const [prompt, setPrompt] = useState(initialPrompt)
  const ownRef = useRef<HTMLTextAreaElement | null>(null)
  const innerRef = props.textareaRef ?? ownRef
  const assist = useComposerAssist({ prompt, setPrompt, boxRef: innerRef })
  const { help } = assist
  const isClosed = Boolean(closedReason) || Boolean(isOffline)
  const lengthProblem = checkMessageLimits(prompt, []) ? 'That message is too long. Attach it as a file instead.' : null
  const text = prompt.trim()
  const canSend =
    !isClosed && !lengthProblem && !attachments.isUploading && !attachments.hasFailed && !hasBlockingWarning(warnings) && (text !== '' || attachments.refs.length > 0)

  useLayoutEffect(() => {
    const box = innerRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [prompt, innerRef])

  function submit() {
    if (!canSend || isStreaming) return
    onSend(text, attachments.refs)
    help.close()
    setPrompt('')
    attachments.clear()
    innerRef.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape' && isStreaming) {
      event.preventDefault()
      onStop()
    }
  }

  const blanks = countPlaceholders(prompt)
  const chips = (props.contextChips ?? []).map((chip) => (
    <li key={chip.label} className="inline-flex min-h-8 max-w-[260px] items-center gap-2 rounded-md bg-accent-soft pl-2 pr-1 text-small text-accent-soft-ink">
      {chip.icon === 'workspace' ? <Books size={16} aria-hidden="true" className="shrink-0" /> : <FileText size={16} aria-hidden="true" className="shrink-0" />}
      <span className="truncate">{chip.label}</span>
      <IconButton label={`Remove ${chip.label}`} size="sm" className="size-6! pointer-coarse:size-8!" onPress={chip.onRemove}>
        <X size={14} aria-hidden="true" />
      </IconButton>
    </li>
  ))

  return (
    <form
      aria-label="Message composer"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 rounded-xl border border-edge-strong bg-surface p-2.5 pb-2 shadow-composer transition-colors duration-[var(--duration-fast)] focus-within:border-focus focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus"
    >
      {(chips.length > 0 || attachments.items.length > 0) && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-0.5">
          {chips.length > 0 && <ul aria-label="Chat settings" className="flex flex-wrap gap-1.5">{chips}</ul>}
          <FileChipList files={attachments.items} label="Files to send" onRemove={attachments.remove} />
        </div>
      )}
      <ComposerNotices
        warnings={warnings}
        problems={attachments.problems}
        onFix={props.onFix}
        onDismissProblems={attachments.dismissProblems}
        lengthProblem={lengthProblem}
      />
      <label htmlFor={props.inputId} className="vh">
        {props.label ?? 'Message'}
      </label>
      <textarea
        id={props.inputId}
        ref={innerRef}
        rows={1}
        value={prompt}
        disabled={isClosed}
        data-route-focus={props.routeFocus ? '' : undefined}
        placeholder={isOffline ? 'You’re offline' : (closedReason ?? props.placeholder ?? 'Ask anything, or drop in a file')}
        readOnly={help.state === 'loading'}
        onChange={(event) => {
          if (prompt === '' && event.target.value !== '') props.onDraftStart?.()
          assist.clearNote()
          setPrompt(event.target.value)
        }}
        onBlur={props.onDraftBlur}
        onKeyDown={onKeyDown}
        className="max-h-[220px] min-h-7 w-full resize-none bg-transparent px-2 py-1.5 text-body leading-[26px] outline-none selection:bg-accent selection:text-accent-ink read-only:text-ink-2 disabled:cursor-not-allowed"
      />
      {blanks > 0 && !isClosed && <BlanksHint onNext={() => innerRef.current && selectNextPlaceholder(innerRef.current, (innerRef.current.selectionEnd ?? 0))} />}
      <p role="status" className="px-2 text-small text-ink-2 empty:hidden">{assist.note}</p>
      {help.isOpen && <HelpMeAskPanel help={help} panelRef={assist.panelRef} onUse={assist.applySuggestion} onKeepMine={assist.keepMine} />}
      <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1 max-[479px]:basis-full">
          {props.tools}
          {props.canAssist !== false && <HelpMeAskButton isOpen={help.isOpen} isDisabled={isClosed || isStreaming} onPress={assist.press} />}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-1 max-[479px]:w-full">
          <div className="min-w-0 max-[479px]:flex-1">{props.trailing}</div>
          <SendButton isStreaming={isStreaming} canSend={canSend} label={props.sendLabel ?? 'Send message'} onStop={onStop} />
        </div>
      </div>
      {attachments.isUploading && <p className="vh" role="status">Uploading files</p>}
    </form>
  )
}

function SendButton({ isStreaming, canSend, label, onStop }: { isStreaming: boolean; canSend: boolean; label: string; onStop: () => void }) {
  const base = 'grid size-9 place-items-center rounded-full outline-none transition-[transform,background-color] duration-[var(--duration-press)] pointer-coarse:size-11 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus'
  if (isStreaming) {
    return (
      <Tooltip text="Stop  Esc">
        <IconButton label="Stop writing" onPress={onStop} className={cx(base, 'rounded-full! bg-ink! text-canvas! data-[hovered]:bg-ink-2!')}>
          <Stop size={18} weight="fill" aria-hidden="true" />
        </IconButton>
      </Tooltip>
    )
  }
  return (
    <IconButton
      label={label}
      type="submit"
      isDisabled={!canSend}
      className={cx(base, 'rounded-full! bg-accent! text-accent-ink! data-[hovered]:bg-accent-hover! data-[disabled]:bg-sunken! data-[disabled]:text-ink-3!')}
    >
      <ArrowUp size={18} weight="bold" aria-hidden="true" />
    </IconButton>
  )
}

interface ThinkToggleProps {
  isSelected: boolean
  onChange: (isSelected: boolean) => void
}

// Only rendered for models that can think. aria-pressed comes from RAC's ToggleButton.
export function ThinkToggle({ isSelected, onChange }: ThinkToggleProps) {
  return (
    <Tooltip text={THINK_TOOLTIP}>
      <ToggleButton
        isSelected={isSelected}
        onChange={onChange}
        className={buttonClass('ghost', 'sm', false, 'gap-1.5! px-2! data-[selected]:bg-accent-soft! data-[selected]:text-accent-soft-ink! sm:px-2.5!')}
      >
        <Brain size={20} aria-hidden="true" />
        <span className="max-sm:vh">Think harder</span>
      </ToggleButton>
    </Tooltip>
  )
}


// Shown while the box holds [bracketed] blanks. The button jumps to the next one, since Tab leaves the box.
function BlanksHint({ onNext }: { onNext: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-small text-ink-2">
      Fill in the [bracketed] parts, then send.
      <Button variant="link" onPress={onNext} className="text-small">Go to next blank</Button>
    </p>
  )
}
