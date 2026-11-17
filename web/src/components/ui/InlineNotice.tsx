import type { ReactNode } from 'react'
import { CheckCircle, Info, Warning, WarningCircle } from '@phosphor-icons/react'
import { cx } from './cx'

export type NoticeTone = 'info' | 'ok' | 'warn' | 'bad'

const TONES: Record<NoticeTone, string> = {
  info: 'bg-sunken text-ink',
  ok: 'bg-ok-soft text-ok-soft-ink',
  warn: 'bg-warn-soft text-warn-soft-ink',
  bad: 'bg-danger-soft text-danger-soft-ink',
}

const ICONS = { info: Info, ok: CheckCircle, warn: Warning, bad: WarningCircle }

interface InlineNoticeProps {
  tone?: NoticeTone
  children: ReactNode
  // Buttons shown under the text.
  actions?: ReactNode
  className?: string
}

// Errors use role=alert so they are announced; the other tones use role=status.
export function InlineNotice({ tone = 'info', children, actions, className }: InlineNoticeProps) {
  const Icon = ICONS[tone]
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('flex items-start gap-2.5 rounded-lg px-3.5 py-3', TONES[tone], className)}>
      <Icon size={20} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div>{children}</div>
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
