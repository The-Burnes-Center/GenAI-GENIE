import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Books, Columns, Moon, ShieldCheck, Sun } from '@phosphor-icons/react'
import { usePublicConfig } from '../../api/public-config'
import { Logo } from '../../components/brand/Logo'
import { IconButton } from '../../components/ui'
import { useTheme } from '../../theme/ThemeContext'

const ASIDE_POINTS = [
  { Icon: ShieldCheck, text: 'Your organization runs Genie. Your chats stay in your account.' },
  { Icon: Columns, text: 'Try different AI models side by side and keep the one that works.' },
  { Icon: Books, text: "Ask questions of your team's documents and see where each answer came from." },
]

// Frame for every screen outside the signed-in shell: a quiet aside on wide screens and one centered column.
export function AuthLayout({ children }: { children: ReactNode }) {
  const { resolved, setPreference } = useTheme()
  const config = usePublicConfig()
  const isDark = resolved === 'dark'
  const canSignUp = config.data?.signupMode === 'open'
  return (
    <div className="grid min-h-dvh grid-cols-1 min-[860px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside aria-label="About Genie" className="hidden flex-col justify-between border-r border-edge bg-sunken px-14 py-12 min-[860px]:flex">
        <Link to="/signin" aria-label="Genie" className="self-start rounded-md">
          <Logo height={36} />
        </Link>
        <div>
          <h2 className="max-w-[14ch] text-display font-semibold">One calm place to work with AI.</h2>
          <ul className="mt-7 grid max-w-[40ch] gap-3.5 text-body text-ink-2">
            {ASIDE_POINTS.map(({ Icon, text }) => (
              <li key={text} className="flex gap-3">
                <Icon size={20} className="mt-[3px] shrink-0 text-accent" aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-small text-ink-3">
          {canSignUp ? 'Create an account with your work email.' : 'Access is by invitation. Ask your administrator if you need an account.'}
        </p>
      </aside>
      <main id="main" tabIndex={-1} className="relative flex flex-col items-center justify-center px-5 py-8 outline-none">
        <IconButton
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]"
          onPress={() => setPreference(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </IconButton>
        {children}
      </main>
    </div>
  )
}

// One 380 px column with the logo on narrow screens.
export function AuthCard({ children, as: Tag = 'div', onSubmit }: { children: ReactNode; as?: 'div' | 'form'; onSubmit?: React.FormEventHandler }) {
  return (
    <Tag onSubmit={onSubmit} noValidate={Tag === 'form' || undefined} className="animate-view grid w-full max-w-[380px] gap-5">
      <Link to="/signin" aria-label="Genie" className="mb-2 self-start rounded-md min-[860px]:hidden">
        <Logo height={28} />
      </Link>
      {children}
    </Tag>
  )
}

interface AuthHeadingProps {
  children: ReactNode
  lead?: ReactNode
  // Moves focus to the heading when the step appears (for steps without a field to focus).
  shouldFocus?: boolean
}

export function AuthHeading({ children, lead, shouldFocus }: AuthHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (shouldFocus) ref.current?.focus({ preventScroll: true })
  }, [shouldFocus])
  return (
    <div className="grid gap-2">
      <h1 ref={ref} tabIndex={-1} className="text-h1 font-semibold outline-none">{children}</h1>
      {lead && <p className="text-ink-2">{lead}</p>}
    </div>
  )
}

interface StatusScreenProps {
  icon: ReactNode
  title: string
  children: ReactNode
  actions: ReactNode
  role?: 'status'
}

// Full-page state with one clear action: waiting for approval, suspended, closed sign-up, waiting for a device.
export function StatusScreen({ icon, title, children, actions, role }: StatusScreenProps) {
  return (
    <div role={role} className="animate-view grid w-full max-w-[400px] justify-items-start gap-3.5">
      <Link to="/signin" aria-label="Genie" className="mb-2 rounded-md min-[860px]:hidden">
        <Logo height={28} />
      </Link>
      <span className="text-accent [&>svg]:size-9" aria-hidden="true">{icon}</span>
      <AuthHeading shouldFocus>{title}</AuthHeading>
      <p className="text-body text-ink-2">{children}</p>
      <div className="mt-1 flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}
