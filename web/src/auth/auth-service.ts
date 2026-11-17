import {
  associateWebAuthnCredential,
  autoSignIn,
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  deleteWebAuthnCredential,
  fetchAuthSession,
  listWebAuthnCredentials,
  resetPassword,
  signIn,
  signOut,
  signUp,
  updatePassword,
  type AuthWebAuthnCredential,
} from 'aws-amplify/auth'
import { isEmailOtpEnabled } from '../config'
import { mapSignInOutput, type FactorEnv, type SignInOutcome } from './auth-machine'

// Thin wrappers over Amplify so the rest of the app never imports Amplify directly.

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function'
}

export function currentFactorEnv(): FactorEnv {
  return { emailOtpEnabled: isEmailOtpEnabled(), passkeysSupported: passkeysSupported() }
}

// Starts choice-based sign-in. Cognito answers with the first factors this account can use.
export async function startSignIn(email: string, env: FactorEnv): Promise<SignInOutcome> {
  const output = await signIn({ username: email, options: { authFlowType: 'USER_AUTH' } })
  return mapSignInOutput(output, env)
}

// Answers the current challenge: a factor name when choosing, otherwise the password, code or new password.
export async function respondToChallenge(response: string, env: FactorEnv): Promise<SignInOutcome> {
  const output = await confirmSignIn({ challengeResponse: response })
  return mapSignInOutput(output, env)
}

export async function signUpAccount(email: string, password: string): Promise<boolean> {
  const output = await signUp({
    username: email,
    password,
    options: {
      userAttributes: { email },
      autoSignIn: { authFlowType: 'USER_AUTH' },
    },
  })
  return output.nextStep.signUpStep === 'CONFIRM_SIGN_UP'
}

export type SignUpConfirmation = { kind: 'signIn'; outcome: SignInOutcome } | { kind: 'manualSignIn' }

export async function confirmAccount(email: string, code: string, env: FactorEnv): Promise<SignUpConfirmation> {
  const output = await confirmSignUp({ username: email, confirmationCode: code })
  if (output.nextStep.signUpStep !== 'COMPLETE_AUTO_SIGN_IN') return { kind: 'manualSignIn' }
  return { kind: 'signIn', outcome: mapSignInOutput(await autoSignIn(), env) }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await resetPassword({ username: email })
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  await confirmResetPassword({ username: email, confirmationCode: code, newPassword })
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await updatePassword({ oldPassword, newPassword })
}

export async function endSession(): Promise<void> {
  await signOut()
}

export type TokenProvider = () => Promise<string | null>

// Amplify is the default. Mock mode (src/mock) swaps in a fake token so the API layer runs without Cognito.
async function amplifyIdToken(): Promise<string | null> {
  // fetchAuthSession refreshes expired tokens on its own.
  const session = await fetchAuthSession()
  return session.tokens?.idToken?.toString() ?? null
}

let tokenProvider: TokenProvider = amplifyIdToken

export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider ?? amplifyIdToken
}

export function getIdToken(): Promise<string | null> {
  return tokenProvider()
}

export async function hasActiveSession(): Promise<boolean> {
  try {
    return (await getIdToken()) !== null
  } catch {
    return false
  }
}

export async function enrollPasskey(): Promise<void> {
  await associateWebAuthnCredential()
}

// Lists every page of passkeys, following Cognito's nextToken.
export async function listAllPasskeys(): Promise<AuthWebAuthnCredential[]> {
  const credentials: AuthWebAuthnCredential[] = []
  let nextToken: string | undefined
  do {
    const page = await listWebAuthnCredentials({ nextToken })
    credentials.push(...page.credentials)
    nextToken = page.nextToken
  } while (nextToken)
  return credentials
}

export async function removePasskey(credentialId: string): Promise<void> {
  await deleteWebAuthnCredential({ credentialId })
}
