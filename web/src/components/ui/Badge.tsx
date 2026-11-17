import type { ReactNode } from 'react'
import { CheckCircle, Clock, Info, Prohibit, WarningCircle, type Icon } from '@phosphor-icons/react'
import { cx } from './cx'

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-2',
  accent: 'bg-accent-soft text-accent-soft-ink',
  ok: 'bg-ok-soft text-ok-soft-ink',
  warn: 'bg-warn-soft text-warn-soft-ink',
  bad: 'bg-danger-soft text-danger-soft-ink',
}

interface BadgeProps {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span className={cx('inline-flex min-h-[22px] items-center gap-1 whitespace-nowrap rounded-xs px-2 text-caption font-medium', TONES[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export type StatusKind = 'ready' | 'indexing' | 'waiting' | 'failed' | 'suspended' | 'active' | 'pending' | 'info'

const STATUS: Record<StatusKind, { tone: BadgeTone; label: string; Icon: Icon }> = {
  ready: { tone: 'ok', label: 'Ready', Icon: CheckCircle },
  active: { tone: 'ok', label: 'Active', Icon: CheckCircle },
  indexing: { tone: 'accent', label: 'Indexing', Icon: Clock },
  waiting: { tone: 'neutral', label: 'Waiting', Icon: Clock },
  pending: { tone: 'warn', label: 'Waiting for approval', Icon: Clock },
  failed: { tone: 'bad', label: 'Failed', Icon: WarningCircle },
  suspended: { tone: 'bad', label: 'Suspended', Icon: Prohibit },
  info: { tone: 'neutral', label: 'Note', Icon: Info },
}

// Status is never color alone: an icon and words always appear together.
export function StatusChip({ status, label }: { status: StatusKind; label?: string }) {
  const { tone, label: defaultLabel, Icon } = STATUS[status]
  return (
    <Badge tone={tone} icon={<Icon size={14} aria-hidden="true" />}>
      {label ?? defaultLabel}
    </Badge>
  )
}
