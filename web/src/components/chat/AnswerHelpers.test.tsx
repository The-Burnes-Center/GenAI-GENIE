import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CHECK_PROMPT } from '../../chat/answer-helpers'
import { AnswerHelpers } from './AnswerHelpers'

function setup(props: Partial<React.ComponentProps<typeof AnswerHelpers>> = {}) {
  const onSend = vi.fn()
  const onDismissTip = vi.fn()
  render(
    <MemoryRouter>
      <AnswerHelpers text="The fee is $45, due March 3." showTip={false} onDismissTip={onDismissTip} onSend={onSend} {...props} />
    </MemoryRouter>,
  )
  return { onSend, onDismissTip }
}

describe('AnswerHelpers', () => {
  it('sends the refinement text when a chip is pressed', () => {
    const { onSend } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Shorter' }))
    expect(onSend).toHaveBeenCalledWith('Make it shorter.')
  })

  it('sends the verification follow-up from "What should I double-check?"', () => {
    const { onSend } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'What should I double-check?' }))
    expect(onSend).toHaveBeenCalledWith(CHECK_PROMPT)
  })

  it('names what is in this answer, next to the check button', () => {
    setup()
    expect(screen.getByText(/This answer includes dates and numbers\./)).toBeTruthy()
  })

  it('says "these answers" in a comparison and keeps the same check button', () => {
    setup({ scope: 'many' })
    expect(screen.getByRole('button', { name: 'What should I double-check?' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Change or check these answers' })).toBeTruthy()
  })

  it('disables every button when sending is not possible', () => {
    setup({ isDisabled: true })
    for (const button of screen.getAllByRole('button')) expect(button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true').toBe(true)
  })

  it('shows the one-line hint beside the label, not as a separate block, and dismisses it', () => {
    const { onDismissTip } = setup({ showTip: true })
    expect(screen.getByText(/No need to start over/)).toBeTruthy()
    expect(screen.queryByRole('group', { name: /^Tip:/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onDismissTip).toHaveBeenCalled()
  })
})
