// Who the mock server thinks is calling. The fake auth provider writes the sign-in to sessionStorage,
// and the ?asUser page parameter makes the mock user a non-admin.
import type { ProfileStatus } from '../api/types'

export const MOCK_TOKEN = 'mock-token'
const SESSION_KEY = 'genie-mock-session'
const AS_USER_KEY = 'genie-mock-as-user'
export const SEEDED_HINTS_KEY = 'genie-mock-seed-hints'
const DEFAULT_EMAIL = 'staff.member@example.org'

export interface MockSignIn {
  email: string
  status: ProfileStatus
}

export interface MockIdentity {
  sub: string
  email: string
  isAdmin: boolean
  status: ProfileStatus
}

// Storage can be blocked (private windows). Every access is guarded and falls back to the default.
function readItem(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeItem(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the mock falls back to the default identity.
  }
}

export function readMockSignIn(): MockSignIn | null {
  const raw = readItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<MockSignIn>
    if (typeof parsed.email !== 'string') return null
    return { email: parsed.email, status: parsed.status === 'pending' ? 'pending' : 'active' }
  } catch {
    return null
  }
}

export function writeMockSignIn(signIn: MockSignIn | null): void {
  writeItem(SESSION_KEY, signIn ? JSON.stringify(signIn) : null)
}

export function setMockAsUser(asUser: boolean): void {
  writeItem(AS_USER_KEY, asUser ? '1' : null)
}

export function currentIdentity(): MockIdentity {
  const signIn = readMockSignIn() ?? { email: DEFAULT_EMAIL, status: 'active' as const }
  const isAdmin = readItem(AS_USER_KEY) !== '1'
  return {
    sub: isAdmin ? 'mock-admin' : 'mock-user',
    email: signIn.email,
    isAdmin,
    status: signIn.status,
  }
}

// Hints a new mock person starts with, from ?hints= on the page address. Empty by default, so a new email sees first-run.
export function seededHints(): string[] {
  const raw = readItem(SEEDED_HINTS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}
