import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 80

// Keeps a scroll area pinned to the newest text while the person has not scrolled up.
// isAtBottom drives the Jump to latest button.
export function useStickToBottom(ref: RefObject<HTMLElement | null>, contentVersion: unknown) {
  const stick = useRef(true)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const onScroll = useCallback(() => {
    const node = ref.current
    if (!node) return
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX
    stick.current = atBottom
    setIsAtBottom(atBottom)
  }, [ref])

  useEffect(() => {
    const node = ref.current
    if (node && stick.current) node.scrollTop = node.scrollHeight
  }, [ref, contentVersion])

  const jumpToLatest = useCallback(() => {
    const node = ref.current
    if (!node) return
    stick.current = true
    node.scrollTop = node.scrollHeight
    setIsAtBottom(true)
  }, [ref])

  // A new turn always scrolls to the bottom, even if the person was reading above.
  const followNext = useCallback(() => {
    stick.current = true
  }, [])

  return { onScroll, isAtBottom, jumpToLatest, followNext }
}
