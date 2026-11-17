import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { apiFetch, segment, withQuery } from './client'
import { usePagedQuery } from './paging'
import { sessionKeys } from './query-keys'
import type {
  DeleteAllSessionsResponse,
  Feedback,
  FeedbackInput,
  FeedbackResponse,
  ForkInput,
  ForkSessionResponse,
  Page,
  RenameSessionInput,
  Session,
  SessionDetail,
  SessionResponse,
} from './types'

export type { FeedbackInput, ForkInput }

export function listSessions(
  params: { q?: string; cursor?: string },
  signal?: AbortSignal,
): Promise<Page<Session>> {
  return apiFetch<Page<Session>>(withQuery('/api/sessions', params), { signal })
}

export function getSession(id: string, signal?: AbortSignal): Promise<SessionDetail> {
  return apiFetch<SessionDetail>(`/api/sessions/${segment(id)}`, { signal })
}

export async function renameSession(id: string, title: string): Promise<Session> {
  const body: RenameSessionInput = { title }
  const { session } = await apiFetch<SessionResponse>(`/api/sessions/${segment(id)}`, { method: 'PATCH', body })
  return session
}

export function deleteSession(id: string): Promise<void> {
  return apiFetch<void>(`/api/sessions/${segment(id)}`, { method: 'DELETE' })
}

export function deleteAllSessions(): Promise<DeleteAllSessionsResponse> {
  return apiFetch<DeleteAllSessionsResponse>('/api/sessions', { method: 'DELETE' })
}

export async function submitFeedback(
  sessionId: string,
  messageId: string,
  input: FeedbackInput,
): Promise<Feedback> {
  const path = `/api/sessions/${segment(sessionId)}/messages/${segment(messageId)}/feedback`
  const { feedback } = await apiFetch<FeedbackResponse>(path, { method: 'POST', body: input })
  return feedback
}

// Copies one model's turns from a compare session into a new chat session.
export function forkSession(id: string, input: ForkInput): Promise<ForkSessionResponse> {
  return apiFetch<ForkSessionResponse>(`/api/sessions/${segment(id)}/fork`, { method: 'POST', body: input })
}

export function useSessionList(query: string) {
  return usePagedQuery(sessionKeys.list(query), (cursor, signal) =>
    listSessions({ q: query, cursor }, signal),
  )
}

export function useSession(id: string) {
  return useQuery({
    queryKey: sessionKeys.detail(id),
    queryFn: ({ signal }) => getSession(id, signal),
  })
}

export function useRenameSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameSession(id, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  })
}

export function useDeleteAllSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAllSessions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  })
}

export function useForkSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ForkInput }) => forkSession(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  })
}

export function useSubmitFeedback(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, input }: { messageId: string; input: FeedbackInput }) =>
      submitFeedback(sessionId, messageId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) }),
  })
}
