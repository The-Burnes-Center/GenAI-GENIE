import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUser } from '../../api/types'
import { SELF_NOTE } from '../../components/admin/users-helpers'
import { AdminUsersPage } from './AdminUsersPage'

const SELF = 'me@example.org'
const OTHER = 'pat@example.org'
const PENDING = 'new@example.org'

function user(email: string, profileStatus: AdminUser['profileStatus'], isAdmin = false): AdminUser {
  return { username: email, sub: email, email, cognitoStatus: 'CONFIRMED', profileStatus, enabled: true, isAdmin, createdAt: '2026-11-01T12:00:00.000Z' }
}

const updateUser = vi.fn(() => Promise.resolve())
const deleteUser = vi.fn(() => Promise.resolve())

vi.mock('../../api/bootstrap', () => ({ useBootstrap: () => ({ data: { me: { email: SELF } } }) }))
vi.mock('../../api/admin-users', () => {
  const list = (items: AdminUser[]) => ({ isPending: false, isError: false, isSuccess: true, items, hasNextPage: false, isFetchingNextPage: false })
  return {
    useAdminUsers: (status?: string) =>
      status === 'pending' ? list([user(PENDING, 'pending')]) : list([user(SELF, 'active', true), user(OTHER, 'active')]),
    useUpdateAdminUser: () => ({ mutateAsync: updateUser }),
    useDeleteAdminUser: () => ({ mutateAsync: deleteUser }),
    useResetAdminUserPassword: () => ({ mutate: vi.fn() }),
    useInviteUser: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

function renderPage() {
  return render(<MemoryRouter><AdminUsersPage /></MemoryRouter>)
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    updateUser.mockClear()
    deleteUser.mockClear()
  })

  it('disables role and access controls on your own row and explains why', () => {
    renderPage()
    expect(screen.getByText(SELF_NOTE)).toBeTruthy()
    const role = screen.getByRole('button', { name: new RegExp(`Role for ${SELF}`) })
    expect(role.hasAttribute('disabled')).toBe(true)
    const otherRole = screen.getByRole('button', { name: new RegExp(`Role for ${OTHER}`) })
    expect(otherRole.hasAttribute('disabled')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: `Actions for ${SELF}` }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Suspend/ }).getAttribute('aria-disabled')).toBe('true')
    expect(within(menu).getByRole('menuitem', { name: 'Delete user' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('approves a pending sign-up by patching status to active', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: `Approve ${PENDING}` }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ username: PENDING, patch: { status: 'active' } }))
  })

  it('asks before declining and only then deletes the account', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: `Decline ${PENDING}` }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/their account will be removed/)).toBeTruthy()
    expect(deleteUser).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith(PENDING))
  })
})
