import { useEffect, useState } from 'react'

const EXIT_MS = 220

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Keeps something on screen for a moment after it stops being wanted, so it can collapse instead of vanishing.
// With reduced motion there is no wait. `isExiting` is true during the wait.
export function useExitTransition(isVisible: boolean) {
  const [wasVisible, setWasVisible] = useState(isVisible)
  const [isLingering, setIsLingering] = useState(false)

  // Adjusting state while rendering, from a change in props, is the supported way to react to it.
  if (isVisible !== wasVisible) {
    setWasVisible(isVisible)
    setIsLingering(!isVisible && !prefersReducedMotion())
  }

  useEffect(() => {
    if (!isLingering) return
    const timer = window.setTimeout(() => setIsLingering(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [isLingering])

  return { shouldRender: isVisible || isLingering, isExiting: !isVisible && isLingering }
}
