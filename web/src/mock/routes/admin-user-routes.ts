import type { AdminUser, InviteInput, InviteUserResponse, Page, ResetPasswordResponse, UpdateUserResponse, UserPatch, UserRole } from '../../api/types'
import { json, noContent, MockHttpError, paginate, readJson, requireText } from '../http'
import { getStore, nextId } from '../store'
import type { MockRoute } from '../route-types'
import type { MockIdentity } from '../identity'
import { findUser, recordAudit } from './shared'

// Pending is set by sign-up, never by an admin, so PATCH accepts only these two.
function isProfileStatus(value: unknown): value is 'active' | 'suspended' {
  return value === 'active' || value === 'suspended'
}

function listUsers(url: URL): Response {
  const status = url.searchParams.get('status')
  const users = getStore().users.filter((user) => !status || user.profileStatus === status)
  return json<Page<AdminUser>>(paginate(users, url.searchParams.get('cursor')))
}

function inviteUser(email: string, role: UserRole): AdminUser {
  const store = getStore()
  if (store.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    throw new MockHttpError(409, 'CONFLICT', 'An account with this email already exists.')
  }
  const username = nextId('u')
  const user: AdminUser = {
    username,
    sub: username,
    email,
    cognitoStatus: 'FORCE_CHANGE_PASSWORD',
    profileStatus: 'active',
    enabled: true,
    isAdmin: role === 'admin',
    createdAt: new Date().toISOString(),
  }
  store.users.push(user)
  return user
}

async function createUser(request: Request, identity: MockIdentity): Promise<Response> {
  const body = await readJson<Partial<Record<keyof InviteInput, unknown>>>(request)
  const email = requireText(body.email, 'work email').toLowerCase()
  if (!email.includes('@')) throw new MockHttpError(400, 'BAD_REQUEST', 'Enter a valid email address.')
  const user = inviteUser(email, body.role === 'admin' ? 'admin' : 'user')
  recordAudit(identity, 'Invited user', email, `Role: ${user.isAdmin ? 'admin' : 'user'}`)
  return json<InviteUserResponse>({ user }, 201)
}

function changeRole(user: AdminUser, role: UserRole, actorEmail: string): string {
  if (user.email === actorEmail && role === 'user') {
    throw new MockHttpError(409, 'CONFLICT', 'Admins cannot remove their own admin role.')
  }
  user.isAdmin = role === 'admin'
  return `Role: ${role}`
}

function changeStatus(user: AdminUser, status: 'active' | 'suspended', actorEmail: string): string {
  if (user.email === actorEmail && status === 'suspended') {
    throw new MockHttpError(409, 'CONFLICT', 'Admins cannot suspend themselves.')
  }
  user.profileStatus = status
  user.enabled = status === 'active'
  user.cognitoStatus = status === 'suspended' ? 'DISABLED' : 'CONFIRMED'
  return status === 'suspended' ? 'Status: suspended' : 'Approved or reinstated'
}

async function patchUser(username: string, request: Request, identity: MockIdentity): Promise<Response> {
  const body = await readJson<Partial<Record<keyof UserPatch, unknown>>>(request)
  const user = findUser(username)
  const notes: string[] = []
  if (body.role === 'admin' || body.role === 'user') notes.push(changeRole(user, body.role, identity.email))
  if (isProfileStatus(body.status)) notes.push(changeStatus(user, body.status, identity.email))
  for (const note of notes) recordAudit(identity, 'Changed user', user.email, note)
  return json<UpdateUserResponse>({ updated: true })
}

function deleteUser(username: string, identity: MockIdentity): Response {
  const user = findUser(username)
  if (user.email === identity.email) throw new MockHttpError(409, 'CONFLICT', 'Admins cannot delete their own account.')
  const store = getStore()
  store.users.splice(store.users.indexOf(user), 1)
  recordAudit(identity, 'Deleted user', user.email, 'Declined or removed')
  return noContent()
}

export const adminUserRoutes: MockRoute[] = [
  { method: 'GET', path: '/api/admin/users', access: 'admin', handle: ({ url }) => listUsers(url) },
  { method: 'POST', path: '/api/admin/users', access: 'admin', handle: ({ request, identity }) => createUser(request, identity) },
  {
    method: 'PATCH',
    path: '/api/admin/users/:username',
    access: 'admin',
    handle: ({ params, request, identity }) => patchUser(params.username, request, identity),
  },
  {
    method: 'POST',
    path: '/api/admin/users/:username/reset-password',
    access: 'admin',
    handle: ({ params, identity }) => {
      const user = findUser(params.username)
      recordAudit(identity, 'Sent password reset', user.email, 'Reset code emailed')
      return json<ResetPasswordResponse>({ reset: true })
    },
  },
  { method: 'DELETE', path: '/api/admin/users/:username', access: 'admin', handle: ({ params, identity }) => deleteUser(params.username, identity) },
]
