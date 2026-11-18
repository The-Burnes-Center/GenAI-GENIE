import { useState } from 'react'
import { NavLink } from 'react-router'
import { Books, ClockCounterClockwise, Columns, FileText, GraduationCap, Plus } from '@phosphor-icons/react'
import { SearchField } from '../../components/ui'
import { useDebouncedValue } from '../../components/use-debounced-value'
import { HistoryList } from './HistoryList'
import { NAV_LINK_CLASS } from './nav-classes'

const SEARCH_DELAY_MS = 300

const LINKS = [
  { to: '/compare', label: 'Compare', Icon: Columns },
  { to: '/templates', label: 'Templates', Icon: FileText },
  { to: '/workspaces', label: 'Workspaces', Icon: Books },
  { to: '/learn', label: 'Learn', Icon: GraduationCap },
]

interface ChatNavProps {
  scrollRoot: Element | null
  searchInputRef: React.Ref<HTMLInputElement>
}

// Sidebar content in chat mode: new chat, tools, search, grouped history, All chats.
export function ChatNav({ scrollRoot, searchInputRef }: ChatNavProps) {
  const [search, setSearch] = useState('')
  const query = useDebouncedValue(search.trim(), SEARCH_DELAY_MS)

  return (
    <>
      <nav aria-label="Main" className="mt-2 grid gap-0.5">
        <NavLink
          to="/home"
          end
          aria-keyshortcuts="Alt+N"
          className={`${NAV_LINK_CLASS} border border-edge-strong bg-surface text-ink hover:bg-hover aria-[current=page]:bg-surface`}
        >
          <Plus size={20} aria-hidden="true" />
          New chat
          <kbd aria-hidden="true" className="ml-auto rounded-xs border border-edge-strong px-1.5 text-[11px] leading-[18px] text-ink-3">Alt N</kbd>
        </NavLink>
        {LINKS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={NAV_LINK_CLASS}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <SearchField label="Search chats" className="mx-1 mb-1 mt-4" value={search} onChange={setSearch} inputRef={searchInputRef} />
      <HistoryList query={query} scrollRoot={scrollRoot} />
      <div className="px-1 py-2">
        <NavLink to="/history" className={NAV_LINK_CLASS}>
          <ClockCounterClockwise size={20} aria-hidden="true" />
          All chats
        </NavLink>
      </div>
    </>
  )
}
