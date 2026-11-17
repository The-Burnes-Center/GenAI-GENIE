import { NavLink } from 'react-router'
import { ArrowLeft, ChartBar, Cpu, FileText, GearSix, ListChecks, ThumbsDown, Users } from '@phosphor-icons/react'
import { Badge } from '../../components/ui'
import { NAV_LINK_CLASS } from './nav-classes'

const LINKS = [
  { to: '/admin/users', label: 'Users', Icon: Users },
  { to: '/admin/models', label: 'Models', Icon: Cpu },
  { to: '/admin/templates', label: 'Templates', Icon: FileText },
  { to: '/admin/settings', label: 'Settings', Icon: GearSix },
  { to: '/admin/usage', label: 'Usage', Icon: ChartBar },
  { to: '/admin/feedback', label: 'Feedback', Icon: ThumbsDown },
  { to: '/admin/audit', label: 'Audit log', Icon: ListChecks },
]

// Sidebar content in admin mode. The Users link carries the "N waiting" count for sign-ups to approve.
export function AdminNav({ pendingCount }: { pendingCount: number }) {
  return (
    <nav aria-label="Admin" className="mt-2">
      <NavLink to="/home" className={NAV_LINK_CLASS}>
        <ArrowLeft size={20} aria-hidden="true" />
        Back to Genie
      </NavLink>
      <h2 className="px-2.5 pb-1 pt-4 text-caption font-semibold text-ink-2">Administration</h2>
      <div className="grid gap-0.5">
        {LINKS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={NAV_LINK_CLASS}>
            <Icon size={20} aria-hidden="true" />
            {label}
            {to === '/admin/users' && pendingCount > 0 && (
              <Badge tone="accent" className="ml-auto">{pendingCount} waiting</Badge>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
