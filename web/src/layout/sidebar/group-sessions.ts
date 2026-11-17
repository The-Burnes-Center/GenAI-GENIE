import type { Session } from '../../api/types'

export type HistoryGroupLabel = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older'

export interface HistoryGroup {
  label: HistoryGroupLabel
  sessions: Session[]
}

const GROUP_ORDER: readonly HistoryGroupLabel[] = ['Today', 'Yesterday', 'Previous 7 days', 'Older']
const YESTERDAY_DAYS = 1
const WEEK_DAYS = 7

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// Whole calendar days between two dates in the viewer's time zone.
function daysAgo(updatedAt: string, now: Date): number {
  const msPerDay = 86_400_000
  return Math.round((startOfDay(now) - startOfDay(new Date(updatedAt))) / msPerDay)
}

export function groupLabelFor(updatedAt: string, now: Date): HistoryGroupLabel {
  const days = daysAgo(updatedAt, now)
  if (days <= 0) return 'Today'
  if (days === YESTERDAY_DAYS) return 'Yesterday'
  if (days <= WEEK_DAYS) return 'Previous 7 days'
  return 'Older'
}

// Sessions arrive newest first from the server. Order inside a group is kept, empty groups are dropped.
export function groupSessions(sessions: Session[], now: Date = new Date()): HistoryGroup[] {
  return GROUP_ORDER.map((label) => ({
    label,
    sessions: sessions.filter((session) => groupLabelFor(session.updatedAt, now) === label),
  })).filter((group) => group.sessions.length > 0)
}
