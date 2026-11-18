import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHints } from '../chat/use-hints'
import { clearOverlay } from './hint-overlay'
import { bootstrapKey } from './query-keys'
import type { Bootstrap } from './types'

vi.mock('./client', () => ({ apiFetch: vi.fn() }))
const { apiFetch } = await import('./client')

function boot(hints: Bootstrap['me']['hints']): Bootstrap {
  return { me: { sub: 's', email: 'a@example.org', isAdmin: false, hints } } as Bootstrap
}

function setup(hints: Bootstrap['me']['hints'] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retryDelay: 0 } } })
  client.setQueryData(bootstrapKey, boot(hints))
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, ...renderHook(() => useHints(), { wrapper }) }
}

describe('saved tips', () => {
  beforeEach(() => {
    clearOverlay()
    vi.mocked(apiFetch).mockReset()
  })
  afterEach(clearOverlay)

  it('hides a dismissed tip at once, before the save returns', async () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => undefined))
    const { result } = setup()
    act(() => result.current.markSeen('attach'))
    expect(result.current.seen).toContain('attach')
  })

  it('keeps it hidden when the save fails, even after a refetch brings back the old list', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result, client } = setup()
    act(() => result.current.markSeen('compare'))
    await waitFor(() => expect(vi.mocked(apiFetch).mock.calls.length).toBe(2), { timeout: 4000 })
    act(() => client.setQueryData(bootstrapKey, boot([])))
    expect(result.current.seen).toContain('compare')
  })

  it('does not post a tip that is already seen', () => {
    const { result } = setup(['attach'])
    act(() => result.current.markSeen('attach'))
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
