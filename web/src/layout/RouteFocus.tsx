import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// On route change focus moves to [data-route-focus] (the composer on home and chat), else the page h1,
// else <main>, so screen readers hear where they are. It only runs when the pathname actually differs from the
// previous one, so the first load (and StrictMode's second effect run) never moves focus.
export function RouteFocus() {
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    const frame = requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>('[data-route-focus]') ??
        document.querySelector<HTMLElement>('main h1') ??
        document.getElementById('main')
      if (!target) return
      if (!target.hasAttribute('tabindex') && !/^(INPUT|TEXTAREA|BUTTON|A)$/.test(target.tagName)) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return null
}
