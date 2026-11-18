import { useMemo } from 'react'
import { flattenPages } from '../api/paging'
import { useSessionList } from '../api/sessions'
import type { Session } from '../api/types'

const RECENT_COUNT = 3
const MS_PER_DAY = 86_400_000

// The newest chats first, as the server sends them.
export function recentSessions(sessions: Session[]): Session[] {
  return sessions.slice(0, RECENT_COUNT)
}

export function sessionHref(session: Session): string {
  return session.mode === 'compare' ? `/compare/${session.sessionId}` : `/chat/${session.sessionId}`
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// "Today", "Yesterday", or a short date, in the viewer's time zone.
export function whenLabel(updatedAt: string, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(updatedAt))) / MS_PER_DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return new Date(updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Shares the sidebar's first page of history, so it costs no extra request.
export function useRecentChats() {
  const list = useSessionList('')
  const sessions = useMemo(() => recentSessions(flattenPages(list.data)), [list.data])
  return { sessions, isPending: list.isPending, isSuccess: list.isSuccess }
}
