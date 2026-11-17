import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RootLayout } from '../../layout/RootLayout'
import { LinkButton } from './Button'

function renderLinks() {
  const router = createMemoryRouter(
    [
      {
        element: <RootLayout />,
        children: [
          {
            path: '/',
            element: (
              <>
                <LinkButton href="/history">Go to history</LinkButton>
                <LinkButton href="https://example.org/docs" target="_blank">Read the docs</LinkButton>
              </>
            ),
          },
          { path: '/history', element: <p>History page</p> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('LinkButton', () => {
  it('navigates in-app hrefs through the router, without a page load', async () => {
    const router = renderLinks()
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    screen.getByRole('link', { name: 'Go to history' }).dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(router.state.location.pathname).toBe('/history')
    expect(await screen.findByText('History page')).toBeTruthy()
  })

  it('leaves external links to the browser', () => {
    const router = renderLinks()
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    fireEvent(screen.getByRole('link', { name: 'Read the docs' }), event)
    expect(event.defaultPrevented).toBe(false)
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('link', { name: 'Read the docs' }).getAttribute('href')).toBe('https://example.org/docs')
  })
})
