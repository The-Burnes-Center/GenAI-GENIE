import { useState } from 'react'
import { Link } from 'react-router'
import { SidebarSimple } from '@phosphor-icons/react'
import { Logo } from '../components/brand/Logo'
import { IconButton, Tooltip } from '../components/ui'
import { AccountMenu } from './sidebar/AccountMenu'
import { AdminNav } from './sidebar/AdminNav'
import { ChatNav } from './sidebar/ChatNav'

interface SidebarProps {
  appName: string
  email: string
  isAdmin: boolean
  pendingCount: number
  mode: 'chat' | 'admin'
  isOpen: boolean
  onClose: () => void
  searchInputRef: React.Ref<HTMLInputElement>
}

// Docked at 1024 px and up, an off-canvas drawer below. `inert` while closed keeps hidden links out of the tab order.
export function Sidebar({ appName, email, isAdmin, pendingCount, mode, isOpen, onClose, searchInputRef }: SidebarProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  return (
    <aside
      id="sidebar"
      aria-label="Sidebar"
      inert={!isOpen}
      data-open={isOpen}
      className={
        'z-50 flex min-h-0 w-[var(--sidebar-width)] flex-col overflow-hidden border-r border-edge bg-sunken ' +
        'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[min(320px,86vw)] max-lg:-translate-x-full max-lg:shadow-dialog max-lg:invisible ' +
        'max-lg:transition-[transform,visibility] max-lg:duration-[var(--duration-slow)] max-lg:ease-[var(--ease-drawer)] ' +
        'max-lg:data-[open=true]:visible max-lg:data-[open=true]:translate-x-0 lg:data-[open=false]:invisible'
      }
    >
      <div className="flex items-center justify-between py-3 pl-4 pr-3">
        <Link to="/home" aria-label={`${appName}, new chat`} className="rounded-md">
          <Logo height={28} appName={appName} />
        </Link>
        <Tooltip text="Close sidebar  Alt S">
          <IconButton label="Close sidebar" onPress={onClose}>
            <SidebarSimple size={20} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </div>
      <div ref={setScrollRoot} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {mode === 'admin' ? <AdminNav pendingCount={pendingCount} /> : <ChatNav scrollRoot={scrollRoot} searchInputRef={searchInputRef} />}
      </div>
      <div className="border-t border-edge p-2">
        <AccountMenu email={email} isAdmin={isAdmin} />
      </div>
    </aside>
  )
}
