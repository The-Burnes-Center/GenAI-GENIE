import { useEffect, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import type { SidebarState } from './use-sidebar'

// Alt N new chat, Alt S sidebar, Ctrl or Cmd K search chats. Alt combinations avoid browser commands.
export function useShortcuts(sidebar: SidebarState, searchRef: RefObject<HTMLInputElement | null>): void {
  const navigate = useNavigate()
  const { open, toggle, close, isOpen, isDesktop } = sidebar

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.code === 'KeyN') {
        event.preventDefault()
        navigate('/home')
      } else if (event.altKey && event.code === 'KeyS') {
        event.preventDefault()
        toggle()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        open()
        window.setTimeout(() => searchRef.current?.focus(), 30)
      } else if (event.key === 'Escape' && !isDesktop && isOpen && !document.querySelector('[role=dialog],[role=menu],[role=listbox]')) {
        close()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, toggle, open, close, isOpen, isDesktop, searchRef])
}
