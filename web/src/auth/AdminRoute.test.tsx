import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useBootstrap } from '../api/bootstrap'
import type { Bootstrap } from '../api/types'
import { AdminRoute } from './AdminRoute'

vi.mock('../api/bootstrap', () => ({ useBootstrap: vi.fn() }))

const mockedUseBootstrap = vi.mocked(useBootstrap)

function bootstrapFor(isAdmin: boolean): ReturnType<typeof useBootstrap> {
  const data = { me: { sub: 'u', email: 'a@b.c', isAdmin, status: 'active' } } as unknown as Bootstrap
  return { isPending: false, isError: false, data } as unknown as ReturnType<typeof useBootstrap>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<p>Admin users table</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminRoute', () => {
  beforeEach(() => {
    mockedUseBootstrap.mockReset()
  })

  it('shows a not-found page to a non-admin', () => {
    mockedUseBootstrap.mockReturnValue(bootstrapFor(false))
    renderAt('/admin/users')
    expect(screen.queryByText('Admin users table')).toBeNull()
    expect(screen.getByText("We can't find that page")).toBeTruthy()
  })

  it('shows admin pages to an admin', () => {
    mockedUseBootstrap.mockReturnValue(bootstrapFor(true))
    renderAt('/admin/users')
    expect(screen.getByText('Admin users table')).toBeTruthy()
  })

  it('shows a loading state while the profile is loading', () => {
    mockedUseBootstrap.mockReturnValue({ isPending: true, isError: false } as unknown as ReturnType<typeof useBootstrap>)
    renderAt('/admin/users')
    expect(screen.queryByText('Admin users table')).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
