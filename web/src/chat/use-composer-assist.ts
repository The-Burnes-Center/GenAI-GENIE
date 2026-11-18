import { useRef, useState, type RefObject } from 'react'
import { toast } from '../components/ui'
import { assistBlockedReason } from './assist-state'
import { selectNextPlaceholder } from './placeholders'
import { useHelpMeAsk } from './use-help-me-ask'

interface ComposerAssistInput {
  prompt: string
  setPrompt: (text: string) => void
  boxRef: RefObject<HTMLTextAreaElement | null>
}

// Everything the message box needs for "Help me ask": the panel state, what the button does when pressed (start,
// say what is missing, or focus the open panel), and what happens to the person's text on each choice.
export function useComposerAssist({ prompt, setPrompt, boxRef }: ComposerAssistInput) {
  const help = useHelpMeAsk()
  const { close } = help
  const panelRef = useRef<HTMLElement>(null)
  const [note, setNote] = useState('')

  function press() {
    if (help.isOpen) {
      panelRef.current?.focus()
      return
    }
    const reason = assistBlockedReason(prompt)
    setNote(reason ?? '')
    if (reason) boxRef.current?.focus()
    else help.start(prompt)
  }

  // Swaps the box's text for the suggestion, and offers Undo so nothing is lost.
  function applySuggestion(suggested: string) {
    const previous = prompt
    setPrompt(suggested)
    close()
    toast.show('Your message was replaced.', { actionLabel: 'Undo', onAction: () => setPrompt(previous) })
    requestAnimationFrame(() => {
      const box = boxRef.current
      if (box && !selectNextPlaceholder(box, 0)) box.focus()
    })
  }

  function keepMine() {
    close()
    boxRef.current?.focus()
  }

  return { help, panelRef, note, clearNote: () => setNote(''), press, applySuggestion, keepMine }
}
