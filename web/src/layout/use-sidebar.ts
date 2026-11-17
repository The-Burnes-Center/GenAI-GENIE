import { useCallback, useState } from 'react'
import { useLocation } from 'react-router'
import { DESKTOP_QUERY, useMediaQuery } from '../components/ui'

const STORAGE_KEY = 'genie-sidebar'

function readStoredOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'closed'
  } catch {
    return true
  }
}

function storeOpen(isOpen: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, isOpen ? 'open' : 'closed')
  } catch {
    // Storage is unavailable: the choice lasts for this page view only.
  }
}

export interface SidebarState {
  isDesktop: boolean
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

// Desktop: docked, remembered per browser. Under 1024 px: an off-canvas drawer that starts closed
// and closes on every route change.
export function useSidebar(): SidebarState {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [isDockedOpen, setIsDockedOpen] = useState(readStoredOpen)
  // The drawer is open only for the path it was opened on, so every route change closes it.
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const { pathname } = useLocation()
  const isDrawerOpen = drawerPath === pathname

  const toggle = useCallback(() => {
    if (isDesktop) {
      setIsDockedOpen((current) => {
        storeOpen(!current)
        return !current
      })
    } else {
      setDrawerPath(isDrawerOpen ? null : pathname)
    }
  }, [isDesktop, isDrawerOpen, pathname])

  const open = useCallback(() => (isDesktop ? setIsDockedOpen(true) : setDrawerPath(pathname)), [isDesktop, pathname])
  const close = useCallback(() => (isDesktop ? setIsDockedOpen(false) : setDrawerPath(null)), [isDesktop])

  return { isDesktop, isOpen: isDesktop ? isDockedOpen : isDrawerOpen, toggle, open, close }
}
