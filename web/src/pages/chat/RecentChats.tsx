import { Link } from 'react-router'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import type { Session } from '../../api/types'
import { sessionHref, whenLabel } from '../../chat/recent-chats'

// "Pick up where you left off": two or three recent chats for a returning person.
export function RecentChats({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return null
  const now = new Date()
  return (
    <section aria-labelledby="recent-heading" className="animate-rise-late mt-5 grid gap-1.5">
      <h2 id="recent-heading" className="text-ui font-semibold text-ink-2">Pick up where you left off</h2>
      <ul className="grid list-none">
        {sessions.map((session) => (
          <li key={session.sessionId}>
            <Link
              to={sessionHref(session)}
              className="-mx-2 flex min-h-10 items-center gap-2.5 rounded-md px-2 text-ink no-underline hover:bg-hover hover:text-ink pointer-coarse:min-h-11"
            >
              <ClockCounterClockwise size={18} aria-hidden="true" className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate">{session.title}</span>
              <span className="shrink-0 text-small text-ink-3">{whenLabel(session.updatedAt, now)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
