import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasskeyPrompt } from './PasskeyPrompt'

const dismiss = vi.fn()
let promptPasskey = true
let seen: string[] = []

vi.mock('../auth/use-auth', () => ({
  useAuth: () => ({ state: { status: 'signedIn', promptPasskey }, enrollPasskey: vi.fn(), dismissPasskeyPrompt: dismiss }),
}))
vi.mock('../chat/use-hints', () => ({ useHints: () => ({ seen, isKnown: true, markSeen: vi.fn() }) }))

describe('PasskeyPrompt', () => {
  it('never shows in a first session, when the welcome card was not done at the start', () => {
    seen = []
    promptPasskey = true
    const { container } = render(<PasskeyPrompt />)
    expect(container.textContent).toBe('')
  })

  it('does not appear later in the same session when the welcome card gets dismissed', () => {
    seen = []
    const { container, rerender } = render(<PasskeyPrompt />)
    seen = ['welcome']
    rerender(<PasskeyPrompt />)
    expect(container.textContent).toBe('')
  })

  it('shows as a bar in the page for someone who finished first-run on an earlier visit', () => {
    seen = ['welcome']
    render(<PasskeyPrompt />)
    const bar = screen.getByRole('region', { name: /Add a passkey/ })
    expect(bar.className).not.toMatch(/fixed|absolute/)
  })

  it('treats Escape as Not now', () => {
    seen = ['welcome']
    dismiss.mockClear()
    render(<PasskeyPrompt />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Not now' }), { key: 'Escape' })
    expect(dismiss).toHaveBeenCalledTimes(1)
  })
})
