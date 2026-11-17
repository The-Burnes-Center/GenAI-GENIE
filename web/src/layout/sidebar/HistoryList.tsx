import { useMemo } from 'react'
import { NavLink, useParams } from 'react-router'
import { flattenPages } from '../../api/paging'
import { describeError } from '../../api/errors'
import { useSessionList } from '../../api/sessions'
import type { Session } from '../../api/types'
import { LoadMore, Skeleton } from '../../components/ui'
import { ChatActions } from './ChatActions'
import { groupSessions } from './group-sessions'

function sessionHref(session: Session): string {
  return session.mode === 'compare' ? `/compare/${session.sessionId}` : `/chat/${session.sessionId}`
}

// Newest chats first, grouped by day, 50 per page with infinite scroll. `query` is the debounced server search.
export function HistoryList({ query, scrollRoot }: { query: string; scrollRoot: Element | null }) {
  const list = useSessionList(query)
  const { sessionId } = useParams()
  const sessions = useMemo(() => flattenPages(list.data), [list.data])
  const groups = useMemo(() => groupSessions(sessions), [sessions])

  if (list.isPending) return <HistorySkeleton />
  if (list.isError) return <p role="alert" className="px-2.5 py-2 text-small text-danger">{describeError(list.error)}</p>
  if (sessions.length === 0) {
    return (
      <p className="px-2.5 py-2 text-small text-ink-3">
        {query ? `No chats match "${query}".` : 'No chats yet. Your chats will appear here.'}
      </p>
    )
  }

  return (
    <nav aria-label="Chat history">
      {groups.map((group) => (
        <div key={group.label} className="mt-3.5">
          <h3 className="px-2.5 pb-1 text-caption font-semibold text-ink-2">{group.label}</h3>
          <ul>
            {group.sessions.map((session) => (
              <li key={session.sessionId} className="group/row relative flex items-center rounded-md hover:bg-hover">
                <NavLink
                  to={sessionHref(session)}
                  className="block min-w-0 flex-1 truncate rounded-md py-[7px] pl-2.5 pr-9 text-ink-2 no-underline hover:text-ink aria-[current=page]:bg-selected aria-[current=page]:text-ink pointer-coarse:py-3"
                >
                  {session.title}
                </NavLink>
                <ChatActions session={session} isCurrent={session.sessionId === sessionId} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <LoadMore
        hasNextPage={Boolean(list.hasNextPage)}
        isFetchingNextPage={list.isFetchingNextPage}
        fetchNextPage={() => void list.fetchNextPage()}
        root={scrollRoot}
      />
    </nav>
  )
}

function HistorySkeleton() {
  return (
    <div role="status" className="grid gap-3 px-2.5 pt-4">
      <span className="vh">Loading chats</span>
      {['w-4/5', 'w-2/3', 'w-11/12', 'w-1/2', 'w-3/4'].map((width) => (
        <Skeleton key={width} className={width} />
      ))}
    </div>
  )
}
