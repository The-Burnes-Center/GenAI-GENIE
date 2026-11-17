import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/use-auth'

export const PASSKEYS_KEY = ['passkeys'] as const

export function usePasskeys() {
  const { listPasskeys } = useAuth()
  return useQuery({ queryKey: PASSKEYS_KEY, queryFn: listPasskeys })
}

export function useRemovePasskey() {
  const { removePasskey } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removePasskey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  })
}

export function useAddPasskey() {
  const { enrollPasskey } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: enrollPasskey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  })
}
