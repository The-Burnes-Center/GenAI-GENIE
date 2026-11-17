import { Navigate, useParams } from 'react-router'

// Old links used /c/:id. They now live at /chat/:id.
export function LegacyChatRedirect() {
  const { sessionId = '' } = useParams()
  return <Navigate to={`/chat/${sessionId}`} replace />
}
