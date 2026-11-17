import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { initialModels, initialSettings } from '../../mock/seed-catalog'
import { SettingsForm } from './SettingsForm'

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/', element: <SettingsForm settings={initialSettings()} models={initialModels()} /> }])
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('SettingsForm', () => {
  it('shows an error and does not save when a value is invalid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderForm()
    fireEvent.change(screen.getByLabelText('Sources read per question'), { target: { value: '99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('Enter a whole number from 1 to 20.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Sources read per question')))
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
