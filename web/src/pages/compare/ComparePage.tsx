import { useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { useBootstrap } from '../../api/bootstrap'
import { useSession } from '../../api/sessions'
import type { Bootstrap } from '../../api/types'
import { compareHandoffs } from '../../chat/compare-handoffs'
import { groupCompareHistory } from '../../chat/compare-state'
import { PageStatus } from '../../components/chat/PageStatus'
import { ErrorText, LoadingText } from '../../components/chat/StatusText'
import { CompareView } from './CompareView'

// /compare starts a comparison. /compare/:sessionId reopens one, rebuilding the turns with a column per model.
export function ComparePage() {
  const { sessionId } = useParams()
  const location = useLocation()
  const bootstrap = useBootstrap()

  if (bootstrap.isPending) return <PageStatus><LoadingText /></PageStatus>
  if (bootstrap.isError) return <PageStatus><ErrorText error={bootstrap.error} /></PageStatus>
  if (!sessionId) return <CompareView key={location.key} bootstrap={bootstrap.data} />
  return <SavedComparison key={sessionId} sessionId={sessionId} bootstrap={bootstrap.data} />
}

function SavedComparison({ sessionId, bootstrap }: { sessionId: string; bootstrap: Bootstrap }) {
  const [handoff] = useState(() => compareHandoffs.peek(sessionId))
  const session = useSession(sessionId)
  if (handoff) {
    return <CompareView bootstrap={bootstrap} sessionId={sessionId} initialModelIds={handoff.modelIds} initialTurns={handoff.turns} />
  }
  if (session.isPending) return <PageStatus><LoadingText label="Loading comparison..." /></PageStatus>
  if (session.isError) return <PageStatus><ErrorText error={session.error} /></PageStatus>
  const { session: detail, messages } = session.data
  const modelIds = detail.modelIds?.length ? detail.modelIds : [detail.modelId]
  return (
    <CompareView
      bootstrap={bootstrap}
      sessionId={sessionId}
      initialModelIds={modelIds}
      initialTurns={groupCompareHistory(messages, modelIds)}
    />
  )
}
