import { Link } from 'react-router'
import { Plus, SidebarSimple } from '@phosphor-icons/react'
import { IconButton, Tooltip, buttonClass } from '../components/ui'
import type { TopbarValue } from './topbar-context'

interface TopbarProps {
  value: TopbarValue | null
  // The toggle and New chat appear only while the sidebar is hidden.
  isSidebarHidden: boolean
  onOpenSidebar: () => void
}

export function Topbar({ value, isSidebarHidden, onOpenSidebar }: TopbarProps) {
  return (
    <header className="flex min-h-[52px] flex-none items-center gap-1 px-3 py-2">
      {isSidebarHidden && (
        <>
          <Tooltip text="Open sidebar  Alt S">
            <IconButton label="Open sidebar" onPress={onOpenSidebar} aria-controls="sidebar">
              <SidebarSimple size={20} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip text="New chat  Alt N">
            <Link to="/home" aria-label="New chat" className={buttonClass('ghost', 'md', true)}>
              <Plus size={20} aria-hidden="true" />
            </Link>
          </Tooltip>
        </>
      )}
      <div className="min-w-0 flex-1 truncate px-2 font-medium">
        {value?.title}
        {value?.meta && <small className="ml-2 font-normal text-ink-3 max-[599px]:hidden">{value.meta}</small>}
      </div>
    </header>
  )
}
