import { useCallback, useEffect, useRef, useState } from 'react'

const REANNOUNCE_DELAY_MS = 60

// Text for a polite live region. Clearing first makes a repeated message read again.
export function useAnnouncer() {
  const [text, setText] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const announce = useCallback((message: string) => {
    window.clearTimeout(timer.current)
    setText('')
    timer.current = window.setTimeout(() => setText(message), REANNOUNCE_DELAY_MS)
  }, [])
  return { text, announce }
}
