import { useEffect, useState, type FocusEvent } from 'react'
import { claimTip } from '../../chat/tip-session'
import { useExitTransition } from '../../chat/use-exit-transition'
import { useHints } from '../../chat/use-hints'

interface WelcomeInput {
  hasMessages: boolean
  // Arrived with a starter or template already chosen (the Learn page "Try it"): the person is past the welcome.
  startedFromLink: boolean
}

// When the first-run welcome card shows, and when it folds away. It is gone for good once any of these happen:
// a starter task is picked, a Learn "Try it" opens home, "Got it" or "Try a first task" is pressed, a message
// is sent, or the person starts typing. Typing keeps the card up until the box loses focus, so the box does not
// jump under the caret.
export function useWelcome({ hasMessages, startedFromLink }: WelcomeInput) {
  const { seen, isKnown, markSeen } = useHints()
  const [isHeld, setIsHeld] = useState(false)
  const isVisible = !hasMessages && isKnown && !startedFromLink && (!seen.includes('welcome') || isHeld)
  const exit = useExitTransition(isVisible)

  useEffect(() => {
    if (isVisible) claimTip('welcome')
  }, [isVisible])

  useEffect(() => {
    if (startedFromLink && isKnown) markSeen('welcome')
  }, [startedFromLink, isKnown, markSeen])

  return {
    ...exit,
    isVisible,
    dismiss: () => markSeen('welcome'),
    onDraftStart: () => {
      if (!isVisible) return
      setIsHeld(true)
      markSeen('welcome')
    },
    // Moving focus into the card itself (a link or button) must not fold it away mid-click.
    onDraftBlur: (event: FocusEvent) => {
      if (event.relatedTarget instanceof Element && event.relatedTarget.closest('[data-welcome-card]')) return
      setIsHeld(false)
    },
    release: () => setIsHeld(false),
  }
}
