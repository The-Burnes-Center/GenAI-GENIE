import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { FeatureTip } from './FeatureTip'

function setup() {
  const onDismiss = vi.fn()
  render(
    <MemoryRouter>
      <FeatureTip title="Compare" link={{ to: '/compare', label: 'Open Compare' }} onDismiss={onDismiss}>
        Send one request to 2 or 3 models.
      </FeatureTip>
      <form aria-label="Message composer"><textarea aria-label="Message" /></form>
    </MemoryRouter>,
  )
  return onDismiss
}

describe('FeatureTip', () => {
  it('does not take focus when it appears, and is reachable by keyboard', () => {
    setup()
    expect(document.activeElement).toBe(document.body)
    expect(screen.getByRole('link', { name: 'Open Compare' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy()
  })

  it('dismisses with Got it', () => {
    const onDismiss = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses with Escape from the message box or the tip, but not from elsewhere', () => {
    const onDismiss = setup()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Got it' }), { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('ignores Escape while a menu is open', () => {
    const onDismiss = setup()
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    document.body.append(menu)
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Escape' })
    expect(onDismiss).not.toHaveBeenCalled()
    menu.remove()
  })
})
