import { act, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RouteFocus } from './RouteFocus'

function Page({ title }: { title: string }) {
  return (
    <main id="main" tabIndex={-1}>
      <h1>{title}</h1>
      <RouteFocus />
    </main>
  )
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/home', element: <Page title="Home" /> },
      { path: '/history', element: <Page title="History" /> },
    ],
    { initialEntries: [path] },
  )
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
  return router
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

describe('RouteFocus', () => {
  it('leaves focus alone on first load, even under StrictMode', async () => {
    renderAt('/home')
    await act(nextFrame)
    await act(nextFrame)
    expect(document.activeElement).toBe(document.body)
  })

  it('moves focus to the page heading when the path changes', async () => {
    const router = renderAt('/home')
    await act(() => router.navigate('/history'))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('History'))
  })
})
