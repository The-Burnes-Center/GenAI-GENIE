import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button as AriaButton } from 'react-aria-components'
import { CaretDown, Keyboard, Moon, ShieldCheck, SignOut, Sun, UserCircle } from '@phosphor-icons/react'
import { useAuth } from '../../auth/use-auth'
import { useTheme } from '../../theme/ThemeContext'
import { Menu, MenuDivider, MenuItem, MenuTrigger, toast } from '../../components/ui'
import { ShortcutsDialog } from './ShortcutsDialog'

interface AccountMenuProps {
  email: string
  isAdmin: boolean
}

function initials(email: string): string {
  const [name = ''] = email.split('@')
  const parts = name.split(/[._-]/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0]?.[0]}${parts[1]?.[0]}` : name.slice(0, 2)).toUpperCase()
}

// Account button at the bottom of the sidebar: account, theme, shortcuts, admin console, sign out.
export function AccountMenu({ email, isAdmin }: AccountMenuProps) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { resolved, setPreference } = useTheme()
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const isDark = resolved === 'dark'

  function onAction(key: React.Key) {
    if (key === 'account') navigate('/account')
    else if (key === 'theme') setPreference(isDark ? 'light' : 'dark')
    else if (key === 'shortcuts') setIsShortcutsOpen(true)
    else if (key === 'admin') navigate('/admin/users')
    else if (key === 'signout') signOut().catch(() => toast.error('Could not sign out. Try again.'))
  }

  return (
    <>
      <MenuTrigger>
        <AriaButton
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none data-[hovered]:bg-hover data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus pointer-coarse:min-h-11"
        >
          <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-small font-semibold text-accent-soft-ink">
            {initials(email)}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate font-medium">{email}</b>
            <span className="block text-caption text-ink-3">{isAdmin ? 'Administrator' : 'Staff'}</span>
          </span>
          <CaretDown size={16} className="text-ink-3" aria-hidden="true" />
        </AriaButton>
        <Menu aria-label="Account" placement="top start" onAction={onAction}>
          <MenuItem id="account" icon={<UserCircle size={20} />}>Account and passkeys</MenuItem>
          <MenuItem id="theme" icon={isDark ? <Sun size={20} /> : <Moon size={20} />}>
            {isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          </MenuItem>
          <MenuItem id="shortcuts" icon={<Keyboard size={20} />}>Keyboard shortcuts</MenuItem>
          {isAdmin ? <MenuDivider /> : null}
          {isAdmin ? <MenuItem id="admin" icon={<ShieldCheck size={20} />}>Admin console</MenuItem> : null}
          <MenuDivider />
          <MenuItem id="signout" icon={<SignOut size={20} />}>Sign out</MenuItem>
        </Menu>
      </MenuTrigger>
      <ShortcutsDialog isOpen={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  )
}
