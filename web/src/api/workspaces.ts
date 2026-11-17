import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, segment, withQuery } from './client'
import { flattenPages, usePagedQuery } from './paging'
import { workspaceKeys } from './query-keys'
import type {
  DocumentInput,
  DocumentResponse,
  Page,
  Workspace,
  WorkspaceDetail,
  WorkspaceDocument,
  WorkspaceInput,
  WorkspacePatch,
  WorkspaceResponse,
} from './types'

export const DOCUMENT_POLL_MS = 5_000

export type { DocumentInput, WorkspaceInput, WorkspacePatch }

export function listWorkspaces(cursor?: string, signal?: AbortSignal): Promise<Page<Workspace>> {
  return apiFetch<Page<Workspace>>(withQuery('/api/workspaces', { cursor }), { signal })
}

export async function createWorkspace(input: WorkspaceInput): Promise<Workspace> {
  const { workspace } = await apiFetch<WorkspaceResponse>('/api/workspaces', { method: 'POST', body: input })
  return workspace
}

export function getWorkspace(id: string, signal?: AbortSignal): Promise<WorkspaceDetail> {
  return apiFetch<WorkspaceDetail>(`/api/workspaces/${segment(id)}`, { signal })
}

export async function updateWorkspace(id: string, patch: WorkspacePatch): Promise<Workspace> {
  const { workspace } = await apiFetch<WorkspaceResponse>(`/api/workspaces/${segment(id)}`, { method: 'PATCH', body: patch })
  return workspace
}

export function deleteWorkspace(id: string): Promise<void> {
  return apiFetch<void>(`/api/workspaces/${segment(id)}`, { method: 'DELETE' })
}

export async function addWorkspaceDocument(workspaceId: string, input: DocumentInput): Promise<WorkspaceDocument> {
  const { document } = await apiFetch<DocumentResponse>(`/api/workspaces/${segment(workspaceId)}/documents`, {
    method: 'POST',
    body: input,
  })
  return document
}

// Re-starts ingestion for a failed or stuck document.
export async function retryWorkspaceDocument(workspaceId: string, docId: string): Promise<WorkspaceDocument> {
  const { document } = await apiFetch<DocumentResponse>(
    `/api/workspaces/${segment(workspaceId)}/documents/${segment(docId)}/retry`,
    { method: 'POST' },
  )
  return document
}

export function deleteWorkspaceDocument(workspaceId: string, docId: string): Promise<void> {
  return apiFetch<void>(
    `/api/workspaces/${segment(workspaceId)}/documents/${segment(docId)}`,
    { method: 'DELETE' },
  )
}

// Indexing runs in the background, so keep polling while any document is not final.
export function hasPendingDocuments(detail: WorkspaceDetail | undefined): boolean {
  return detail?.documents.some((doc) => doc.status === 'uploading' || doc.status === 'uploaded' || doc.status === 'indexing') ?? false
}

// Poll interval in ms while anything is still being read, or false once every document is final.
export function documentPollInterval(detail: WorkspaceDetail | undefined): number | false {
  return hasPendingDocuments(detail) ? DOCUMENT_POLL_MS : false
}

export function useWorkspaceList() {
  return usePagedQuery(workspaceKeys.list(), (cursor, signal) => listWorkspaces(cursor, signal))
}

export function useWorkspaceListItems() {
  const query = useWorkspaceList()
  return { ...query, items: flattenPages(query.data) }
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: ({ signal }) => getWorkspace(id, signal),
    refetchInterval: (query) => documentPollInterval(query.state.data),
  })
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  })
}

export function useUpdateWorkspace(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: WorkspacePatch) => updateWorkspace(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  })
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  })
}

export function useAddWorkspaceDocument(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DocumentInput) => addWorkspaceDocument(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  })
}

export function useRetryDocument(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) => retryWorkspaceDocument(workspaceId, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  })
}

export function useDeleteWorkspaceDocument(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) => deleteWorkspaceDocument(workspaceId, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
  })
}
