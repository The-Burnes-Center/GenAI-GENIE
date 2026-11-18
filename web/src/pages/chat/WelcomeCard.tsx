import { useState } from 'react'
import { Link } from 'react-router'
import { ChatCircleText, ShieldWarning, WarningCircle } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { RoomIllustration } from '../../components/brand/RoomIllustration'
import { Button } from '../../components/ui'

const RULES_SHOWN = 2
const WIDE_QUERY = '(min-width: 720px)'

interface WelcomeCardProps {
  appName: string
  // From settings.dataRules. Empty hides the "do not share" point.
  rules: string[]
  // True while the card collapses away.
  isExiting: boolean
  onTryFirstTask: () => void
  onDismiss: () => void
}

function Point({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-2.5">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-warm">{icon}</span>
      <div className="min-w-0 text-small text-ink-2">
        <p className="text-ui font-semibold text-ink">{title}</p>
        {children}
      </div>
    </li>
  )
}

// What not to share. Open on wide screens, a closed disclosure on phones so the message box stays in view.
function ShareRules({ rules }: { rules: string[] }) {
  const [isOpen, setIsOpen] = useState(() => window.matchMedia?.(WIDE_QUERY).matches ?? true)
  const shown = rules.slice(0, RULES_SHOWN)
  return (
    <li className="flex min-w-0 gap-2.5">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-warm"><ShieldWarning size={20} /></span>
      <details open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)} className="min-w-0 text-small text-ink-2">
        <summary className="cursor-pointer rounded-xs text-ui font-semibold text-ink pointer-coarse:min-h-11 pointer-coarse:leading-[44px]">What not to share</summary>
        <ul className="mt-0.5 list-disc pl-4">
          {shown.map((rule, index) => (
            <li key={index}>{rule}</li>
          ))}
        </ul>
        {rules.length > shown.length && (
          <p className="mt-1">
            <Link to="/learn#share">See all {rules.length} rules</Link>
          </p>
        )}
      </details>
    </li>
  )
}

// First visit only. A card on the page, not a modal: the message box underneath stays usable. It is short on
// purpose, with details on the Learn page, so the box and the first starter tasks stay above the fold.
export function WelcomeCard({ appName, rules, isExiting, onTryFirstTask, onDismiss }: WelcomeCardProps) {
  return (
    <div data-welcome-card="" data-exiting={isExiting || undefined} className="welcome-collapse">
      <div className="min-h-0 overflow-hidden">
        <section aria-labelledby="welcome-heading" className="animate-rise grid gap-3 rounded-xl border border-warm-edge bg-warm-soft p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <RoomIllustration size={40} className="shrink-0" />
            <h2 id="welcome-heading" className="text-title font-semibold">Three things to know</h2>
          </div>
          <ul className="grid list-none gap-3 min-[720px]:grid-cols-3 min-[720px]:gap-4">
            <Point icon={<ChatCircleText size={20} />} title={`What ${appName} is`}>
              <p>An AI assistant. Tell it what you need and it writes back. Then keep talking to improve the answer.</p>
            </Point>
            {rules.length > 0 && <ShareRules rules={rules} />}
            <Point icon={<WarningCircle size={20} />} title="It can sound sure and still be wrong">
              <p>Check names, numbers, dates and laws before you send, sign or act on them.</p>
            </Point>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onPress={onTryFirstTask}>Try a first task</Button>
            <Button onPress={onDismiss}>Got it</Button>
            <Link to="/learn" className="ml-1 text-ui">Learn the basics</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
