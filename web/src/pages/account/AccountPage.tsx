import type { ReactNode } from 'react'
import { SignOut } from '@phosphor-icons/react'
import { useBootstrap } from '../../api/bootstrap'
import { useAuth } from '../../auth/use-auth'
import { Button, RadioGroup, toast } from '../../components/ui'
import { useTopbar } from '../../layout/topbar-context'
import { useTheme } from '../../theme/ThemeContext'
import type { ThemePreference } from '../../theme/theme-storage'
import { PasskeyList } from './PasskeyList'
import { PasswordForm } from './PasswordForm'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3.5 border-t border-edge py-6 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 id={id} className="text-title font-semibold">{title}</h2>
      {lead && <p className="-mt-2 max-w-[56ch] text-ink-2">{lead}</p>}
      {children}
    </section>
  )
}

export function AccountPage() {
  useTopbar('Account')
  const { data } = useBootstrap()
  const { signOut } = useAuth()
  const { preference, setPreference } = useTheme()

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16 pt-4 md:px-8 md:pb-20 md:pt-6">
      <div className="mb-6">
        <h1 tabIndex={-1} className="text-h1 font-semibold">Account</h1>
        <p className="mt-1 text-body text-ink-2">Your sign-in options and appearance.</p>
      </div>
      <Section id="acct-profile" title="Profile">
        <dl className="grid grid-cols-[120px_1fr] gap-2">
          <dt className="text-ink-3">Email</dt>
          <dd className="break-all">{data?.me.email}</dd>
          <dt className="text-ink-3">Role</dt>
          <dd>{data?.me.isAdmin ? 'Administrator' : 'Staff'}</dd>
        </dl>
      </Section>
      <Section
        id="acct-passkeys"
        title="Passkeys"
        lead="A passkey lets you sign in with Face ID, Touch ID or a security key. It is faster than a password and can't be guessed or phished."
      >
        <PasskeyList />
      </Section>
      <Section id="acct-password" title="Change password"><PasswordForm /></Section>
      <Section id="acct-appearance" title="Appearance">
        <RadioGroup
          label="Theme"
          variant="segmented"
          options={THEME_OPTIONS}
          value={preference}
          onChange={(value) => setPreference(value as ThemePreference)}
        />
      </Section>
      <Section id="acct-signout" title="Sign out">
        <div>
          <Button onPress={() => void signOut().catch(() => toast.error('Could not sign out. Try again.'))}>
            <SignOut size={16} aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </Section>
    </div>
  )
}
