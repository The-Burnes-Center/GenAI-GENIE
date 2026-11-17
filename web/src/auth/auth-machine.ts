// Pure sign-in state machine. Maps Amplify v6 next steps onto the screens the UI shows.
// Step names come from @aws-amplify/auth's AuthNextSignInStep union.

export type FirstFactor = 'WEB_AUTHN' | 'PASSWORD' | 'EMAIL_OTP'

export type ChallengeStep =
  | { kind: 'chooseFactor'; factors: FirstFactor[] }
  | { kind: 'password' }
  | { kind: 'emailCode' }
  | { kind: 'newPassword' }

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'challenge'; email: string; step: ChallengeStep }
  | { status: 'signedIn'; promptPasskey: boolean }
  // Cognito refused the sign-in because an administrator disabled the account.
  | { status: 'suspended'; email: string }

export type SignInOutcome = { kind: 'done' } | { kind: 'challenge'; step: ChallengeStep }

export interface FactorEnv {
  emailOtpEnabled: boolean
  passkeysSupported: boolean
}

// Structural subset of Amplify's SignInOutput, so tests can use plain objects.
export interface SignInOutputLike {
  isSignedIn: boolean
  nextStep: { signInStep: string; availableChallenges?: string[] }
}

export class UnsupportedSignInStepError extends Error {
  constructor(step: string) {
    super(`This sign-in step is not supported in this app: ${step}`)
    this.name = 'UnsupportedSignInStepError'
  }
}

const FIRST_FACTOR_ORDER: readonly FirstFactor[] = ['WEB_AUTHN', 'PASSWORD', 'EMAIL_OTP']

// Passkeys first, then password, then email code. Email code needs SES on the pool (config emailOtp).
export function filterFactors(available: string[] | undefined, env: FactorEnv): FirstFactor[] {
  const offered = available ?? []
  return FIRST_FACTOR_ORDER.filter((factor) => {
    if (!offered.includes(factor)) return false
    if (factor === 'EMAIL_OTP') return env.emailOtpEnabled
    if (factor === 'WEB_AUTHN') return env.passkeysSupported
    return true
  })
}

export function mapSignInOutput(output: SignInOutputLike, env: FactorEnv): SignInOutcome {
  if (output.isSignedIn) return { kind: 'done' }
  const { signInStep, availableChallenges } = output.nextStep
  switch (signInStep) {
    case 'CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION':
      return { kind: 'challenge', step: { kind: 'chooseFactor', factors: filterFactors(availableChallenges, env) } }
    case 'CONFIRM_SIGN_IN_WITH_PASSWORD':
      return { kind: 'challenge', step: { kind: 'password' } }
    case 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE':
      return { kind: 'challenge', step: { kind: 'emailCode' } }
    case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
      return { kind: 'challenge', step: { kind: 'newPassword' } }
    default:
      throw new UnsupportedSignInStepError(signInStep)
  }
}

// The passkey prompt is offered once, after a password or email-code sign-in, never after a passkey.
export function stateAfterOutcome(
  outcome: SignInOutcome,
  email: string,
  viaPasskey: boolean,
  passkeyPromptAllowed: boolean,
): AuthState {
  if (outcome.kind === 'done') {
    return { status: 'signedIn', promptPasskey: !viaPasskey && passkeyPromptAllowed }
  }
  return { status: 'challenge', email, step: outcome.step }
}
