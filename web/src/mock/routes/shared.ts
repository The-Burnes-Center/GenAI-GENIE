import type { AdminUser, Session } from '../../api/types'
import type { MockIdentity } from '../identity'
import { getStore, nextId } from '../store'
import type { MockSession } from '../seed-sessions'
import { MockHttpError } from '../http'

// A session without its messages, as the list and detail endpoints return it.
export function sessionSummary(session: MockSession): Session {
  return {
    sessionId: session.sessionId,
    title: session.title,
    mode: session.mode,
    modelId: session.modelId,
    modelIds: session.modelIds,
    workspaceId: session.workspaceId,
    templateId: session.templateId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
  }
}

export function sortedSessions(): MockSession[] {
  return [...getStore().sessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function findSession(id: string): MockSession {
  const session = getStore().sessions.find((item) => item.sessionId === id)
  if (!session) throw new MockHttpError(404, 'NOT_FOUND', 'That chat could not be found.')
  return session
}

export function findUser(username: string): AdminUser {
  const user = getStore().users.find((item) => item.username === username)
  if (!user) throw new MockHttpError(404, 'NOT_FOUND', 'That user could not be found.')
  return user
}

export function pendingCount(): number {
  return getStore().users.filter((user) => user.profileStatus === 'pending').length
}

export function recordAudit(identity: MockIdentity, action: string, target: string, note: string): void {
  const at = new Date().toISOString()
  getStore().audit.unshift({
    id: `${at}#${nextId('a')}`,
    at,
    actorSub: identity.sub,
    actorEmail: identity.email,
    action,
    target,
    details: { note },
  })
}
