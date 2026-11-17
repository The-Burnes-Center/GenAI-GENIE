import type { AdminUser } from '../../api/types'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_DAYS = 7

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

// "Last active" is the last request the person made, not their last sign-in (Addendum item 11).
export function lastActiveLabel(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return 'Never signed in'
  const elapsed = Math.max(0, now - Date.parse(iso))
  if (elapsed < 2 * MINUTE_MS) return 'Just now'
  if (elapsed < HOUR_MS) return plural(Math.floor(elapsed / MINUTE_MS), 'minute')
  if (elapsed < DAY_MS) return plural(Math.floor(elapsed / HOUR_MS), 'hour')
  if (elapsed < WEEK_DAYS * DAY_MS) return plural(Math.floor(elapsed / DAY_MS), 'day')
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function signedUpLabel(iso: string | undefined): string {
  if (!iso) return 'Unknown'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export type UserStatusKind = 'active' | 'invited' | 'suspended'

export function userStatusKind(user: AdminUser): UserStatusKind {
  if (user.profileStatus === 'suspended') return 'suspended'
  return user.cognitoStatus === 'FORCE_CHANGE_PASSWORD' ? 'invited' : 'active'
}

export function isSelf(user: AdminUser, selfEmail: string | undefined): boolean {
  return selfEmail !== undefined && user.email.toLowerCase() === selfEmail.toLowerCase()
}

export const SELF_NOTE = "You can't change your own role or access."
