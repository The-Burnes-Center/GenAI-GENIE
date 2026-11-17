import type { FirstFactor } from './auth-machine'
import type { AuthState } from './auth-machine'

export interface PasskeyInfo {
  credentialId: string
  name: string
  createdAt?: Date
}

export type { AuthState, ChallengeStep, FirstFactor } from './auth-machine'

export interface AuthContextValue {
  state: AuthState
  // Step 1: email. Moves to a factor choice, password, or email code.
  startSignIn: (email: string) => Promise<void>
  // Step 2 (factor choice): passkey, password or email code.
  chooseFactor: (factor: FirstFactor) => Promise<void>
  // Password, email code or new password, depending on the current challenge.
  submitChallenge: (value: string) => Promise<void>
  cancelSignIn: () => void
  // Creates the account. Resolves true when a confirmation code was sent.
  signUp: (email: string, password: string) => Promise<boolean>
  finishSignUp: (email: string, code: string) => Promise<boolean>
  forgotPassword: (email: string) => Promise<void>
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>
  enrollPasskey: () => Promise<void>
  listPasskeys: () => Promise<PasskeyInfo[]>
  removePasskey: (credentialId: string) => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  // "Not now" hides the card for this visit. forever: true remembers it on this browser ("Don't ask again").
  dismissPasskeyPrompt: (options?: { forever?: boolean }) => void
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
}
