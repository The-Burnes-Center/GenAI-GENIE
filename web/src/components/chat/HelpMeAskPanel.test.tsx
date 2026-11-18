import { fireEvent, render as renderUi, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import type { useHelpMeAsk } from '../../chat/use-help-me-ask'
import { HelpMeAskPanel } from './HelpMeAskPanel'

type Help = ReturnType<typeof useHelpMeAsk>

function help(partial: Partial<Help>): Help {
  return { state: 'ready', isOpen: true, result: undefined, error: null, start: vi.fn(), close: vi.fn(), retry: vi.fn(), ...partial } as Help
}

// The panel needs a ref from the message box; tests give it their own.
function render(ui: React.ReactElement<React.ComponentProps<typeof HelpMeAskPanel>>) {
  return renderUi({ ...ui, props: { ...ui.props, panelRef: createRef<HTMLElement>() } })
}

const RESULT = { text: 'Write a note to [who].\n\nUse plain language.', changes: ['A blank for who it is for'] }

describe('HelpMeAskPanel', () => {
  it('announces loading in a status region', () => {
    render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ state: 'loading' })} onUse={vi.fn()} onKeepMine={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toBe('Writing a clearer version.')
  })

  it('shows the suggestion, highlights blanks and lists what was added', () => {
    const { container } = render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ result: RESULT })} onUse={vi.fn()} onKeepMine={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toBe('A clearer version is ready.')
    expect(container.querySelector('mark')?.textContent).toBe('[who]')
    expect(screen.getByText('A blank for who it is for')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'What I added' })).toBeTruthy()
  })

  it('uses the suggestion as written', () => {
    const onUse = vi.fn()
    render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ result: RESULT })} onUse={onUse} onKeepMine={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use this version' }))
    expect(onUse).toHaveBeenCalledWith(RESULT.text)
  })

  it('lets the person edit first, then uses the edited text', () => {
    const onUse = vi.fn()
    render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ result: RESULT })} onUse={onUse} onKeepMine={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit it first' }))
    fireEvent.change(screen.getByLabelText('Edit the suggested version'), { target: { value: 'My own wording' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this version' }))
    expect(onUse).toHaveBeenCalledWith('My own wording')
  })

  it('keeps the person\'s own text on "Keep mine" and on Escape', () => {
    const onKeepMine = vi.fn()
    render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ result: RESULT })} onUse={vi.fn()} onKeepMine={onKeepMine} />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Use this version' }), { key: 'Escape' })
    expect(onKeepMine).toHaveBeenCalledTimes(2)
  })

  it('says so when nothing needed adding', () => {
    render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ result: { text: 'Fine as is.', changes: [] } })} onUse={vi.fn()} onKeepMine={vi.fn()} />)
    expect(screen.getByText(/already clear/)).toBeTruthy()
  })

  it('offers Try again on a failure', () => {
    const retry = vi.fn()
    render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ state: 'error', error: new ApiError(502, 'ASSIST_FAILED', 'The assistant could not rewrite this request.'), retry })} onUse={vi.fn()} onKeepMine={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toContain('could not rewrite')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalled()
  })

  it('shows the daily limit as a warning with no Try again', () => {
    render(<HelpMeAskPanel panelRef={createRef<HTMLElement>()} help={help({ state: 'error', error: new ApiError(429, 'LIMIT_REACHED', 'You can use this 50 times a day. It starts over tomorrow.') })} onUse={vi.fn()} onKeepMine={vi.fn()} />)
    expect(screen.getAllByText(/50 times a day/).length).toBe(1)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeTruthy()
  })
})
