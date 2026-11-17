import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, segment, withQuery } from './client'
import { flattenPages, usePagedQuery } from './paging'
import { adminKeys, bootstrapKey } from './query-keys'
import type {
  AdminUser,
  InviteInput,
  InviteUserResponse,
  Page,
  ProfileStatus,
  ResetPasswordResponse,
  UpdateUserResponse,
  UserPatch,
} from './types'

export type { InviteInput, UserPatch }

export function listAdminUsers(
  params: { status?: ProfileStatus; cursor?: string },
  signal?: AbortSignal,
): Promise<Page<AdminUser>> {
  return apiFetch<Page<AdminUser>>(withQuery('/api/admin/users', params), { signal })
}

export async function inviteUser(input: InviteInput): Promise<AdminUser> {
  const { user } = await apiFetch<InviteUserResponse>('/api/admin/users', { method: 'POST', body: input })
  return user
}

export function updateAdminUser(username: string, patch: UserPatch): Promise<UpdateUserResponse> {
  return apiFetch<UpdateUserResponse>(`/api/admin/users/${segment(username)}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function resetAdminUserPassword(username: string): Promise<ResetPasswordResponse> {
  return apiFetch<ResetPasswordResponse>(`/api/admin/users/${segment(username)}/reset-password`, { method: 'POST' })
}

// Also declines a pending sign-up: the Cognito user and profile are deleted (the UI confirms first).
export function deleteAdminUser(username: string): Promise<void> {
  return apiFetch<void>(`/api/admin/users/${segment(username)}`, { method: 'DELETE' })
}

export function useAdminUsers(status?: ProfileStatus) {
  const query = usePagedQuery(adminKeys.users(status), (cursor, signal) =>
    listAdminUsers({ status, cursor }, signal),
  )
  return { ...query, items: flattenPages(query.data) }
}

// Every admin mutation changes users and writes an audit item, so both caches are refreshed.
function useAdminMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    // The sidebar badge reads pendingCount from bootstrap, so approve and decline must refresh it too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.all }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  })
}

export function useInviteUser() {
  return useAdminMutation(inviteUser)
}

export function useUpdateAdminUser() {
  return useAdminMutation(({ username, patch }: { username: string; patch: UserPatch }) =>
    updateAdminUser(username, patch),
  )
}

export function useResetAdminUserPassword() {
  return useAdminMutation(resetAdminUserPassword)
}

export function useDeleteAdminUser() {
  return useAdminMutation(deleteAdminUser)
}
