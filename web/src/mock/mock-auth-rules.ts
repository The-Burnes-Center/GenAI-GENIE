// Pure rules for the fake sign-in. The email typed picks the scenario, as the prototype's sign-in screens do.
import type { ChallengeStep, FirstFactor } from '../auth/auth-machine'
import type { ProfileStatus } from '../api/types'

export const MOCK_FIRST_FACTORS: FirstFactor[] = ['WEB_AUTHN', 'PASSWORD', 'EMAIL_OTP']
export const MOCK_ALLOWED_DOMAINS = ['example.org', 'example.gov']
export const MOCK_WRONG_PASSWORD = 'wrong'
export const MOCK_DENIED_SIGN_UP_MESSAGE =
  'PreSignUp failed with error Genie accounts are for staff with an @example.org or @example.gov email. Use your work email, or ask your administrator for an invitation.'

// Errors carry the Cognito name, so describeAuthError maps them to the same copy as the real service.
export function mockAuthError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

export type StartPlan = { kind: 'suspended' } | { kind: 'challenge'; step: ChallengeStep }

export function planStartSignIn(email: string): StartPlan {
  const address = email.toLowerCase()
  if (address.includes('suspended')) return { kind: 'suspended' }
  if (address.includes('invited')) return { kind: 'challenge', step: { kind: 'newPassword' } }
  if (address.includes('nopasskey')) return { kind: 'challenge', step: { kind: 'password' } }
  return { kind: 'challenge', step: { kind: 'chooseFactor', factors: MOCK_FIRST_FACTORS } }
}

// Sign-in succeeds for pending accounts, but the server then reports the pending status.
export function signedInStatus(email: string): ProfileStatus {
  return email.toLowerCase().includes('pending') ? 'pending' : 'active'
}

export function isSixDigitCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

export function checkPassword(password: string): void {
  if (password === MOCK_WRONG_PASSWORD) {
    throw mockAuthError('NotAuthorizedException', 'Incorrect username or password.')
  }
}

export function checkEmailCode(code: string): void {
  if (!isSixDigitCode(code) || code === '000000') {
    throw mockAuthError('CodeMismatchException', 'Invalid verification code provided, please try again.')
  }
}

export function checkSignUpEmail(email: string): void {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (!MOCK_ALLOWED_DOMAINS.includes(domain)) {
    throw mockAuthError('UserLambdaValidationException', MOCK_DENIED_SIGN_UP_MESSAGE)
  }
}

export interface MockPasskey {
  credentialId: string
  name: string
  createdAt: Date
}

// In memory only: a page reload resets the list to the preset passkey. Created on first use, so importing
// this module has no side effects and a production build can drop it.
function presetPasskeys(): MockPasskey[] {
  return [{ credentialId: 'mock-passkey-1', name: 'This device', createdAt: new Date('2026-10-12T12:00:00.000Z') }]
}

let passkeys: MockPasskey[] | null = null
let passkeyCounter = 1

function currentPasskeys(): MockPasskey[] {
  passkeys ??= presetPasskeys()
  return passkeys
}

export function listMockPasskeys(): MockPasskey[] {
  return currentPasskeys().map((passkey) => ({ ...passkey }))
}

export function addMockPasskey(): MockPasskey {
  passkeyCounter += 1
  const passkey = { credentialId: `mock-passkey-${passkeyCounter}`, name: 'This browser', createdAt: new Date() }
  passkeys = [...currentPasskeys(), passkey]
  return { ...passkey }
}

export function removeMockPasskey(credentialId: string): void {
  passkeys = currentPasskeys().filter((passkey) => passkey.credentialId !== credentialId)
}

export function resetMockPasskeys(): void {
  passkeys = null
  passkeyCounter = 1
}
