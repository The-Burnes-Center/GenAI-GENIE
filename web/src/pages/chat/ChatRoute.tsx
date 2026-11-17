import { useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { useBootstrap } from '../../api/bootstrap'
import { useSession } from '../../api/sessions'
import type { Bootstrap } from '../../api/types'
import { chatHandoffs } from '../../chat/chat-handoffs'
import { fromStoredMessage } from '../../chat/messages'
import { ErrorText, LoadingText } from '../../components/chat/StatusText'
import { PageStatus } from '../../components/chat/PageStatus'
import { ChatView } from './ChatView'

// /home starts a new chat. /chat/:sessionId loads a saved one. Keys reset the chat when the target changes.
export function ChatRoute() {
  const { sessionId } = useParams()
  const location = useLocation()
  const bootstrap = useBootstrap()

  if (bootstrap.isPending) return <PageStatus><LoadingText /></PageStatus>
  if (bootstrap.isError) return <PageStatus><ErrorText error={bootstrap.error} /></PageStatus>
  if (!sessionId) return <ChatView key={location.key} bootstrap={bootstrap.data} />
  return <SavedChat key={sessionId} sessionId={sessionId} bootstrap={bootstrap.data} />
}

function SavedChat({ sessionId, bootstrap }: { sessionId: string; bootstrap: Bootstrap }) {
  // A chat that was just created on /home brings its messages along, so there is no loading flash.
  const [handoff] = useState(() => chatHandoffs.peek(sessionId))
  const session = useSession(sessionId)
  if (handoff) {
    return (
      <ChatView
        bootstrap={bootstrap}
        sessionId={sessionId}
        title={handoff.title}
        initialModelId={handoff.modelId}
        initialWorkspaceId={handoff.workspaceId}
        initialMessages={handoff.messages}
      />
    )
  }
  if (session.isPending) return <PageStatus><LoadingText label="Loading chat..." /></PageStatus>
  if (session.isError) return <PageStatus><ErrorText error={session.error} /></PageStatus>
  const { session: detail, messages } = session.data
  return (
    <ChatView
      bootstrap={bootstrap}
      sessionId={sessionId}
      title={detail.title}
      initialModelId={detail.modelId}
      initialWorkspaceId={detail.workspaceId}
      initialMessages={messages.map(fromStoredMessage)}
    />
  )
}
