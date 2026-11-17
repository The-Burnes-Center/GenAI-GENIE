import { useSyncExternalStore } from 'react'

// Subscribes to a CSS media query. Returns false when matchMedia is unavailable (tests).
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
}

export const DESKTOP_QUERY = '(min-width: 1024px)'
