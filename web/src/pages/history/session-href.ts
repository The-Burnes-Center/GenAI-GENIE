import type { Session } from '../../api/types'

export function sessionHref(session: Session): string {
  return session.mode === 'compare' ? `/compare/${session.sessionId}` : `/chat/${session.sessionId}`
}
