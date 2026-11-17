import { describe, expect, it } from 'vitest'
import { filterFactors, mapSignInOutput, stateAfterOutcome, UnsupportedSignInStepError } from './auth-machine'
import { describeAuthError } from './auth-errors'

const ALL_ENV = { emailOtpEnabled: true, passkeysSupported: true }

describe('filterFactors', () => {
  it('orders passkeys first, then password, then email code', () => {
    expect(filterFactors(['EMAIL_OTP', 'PASSWORD', 'WEB_AUTHN'], ALL_ENV)).toEqual(['WEB_AUTHN', 'PASSWORD', 'EMAIL_OTP'])
  })

  it('drops email code when config emailOtp is off', () => {
    expect(filterFactors(['PASSWORD', 'EMAIL_OTP'], { ...ALL_ENV, emailOtpEnabled: false })).toEqual(['PASSWORD'])
  })

  it('drops passkeys when the browser has no WebAuthn support', () => {
    expect(filterFactors(['WEB_AUTHN', 'PASSWORD'], { ...ALL_ENV, passkeysSupported: false })).toEqual(['PASSWORD'])
  })

  it('returns nothing when Cognito offers no challenge', () => {
    expect(filterFactors(undefined, ALL_ENV)).toEqual([])
  })
})

describe('mapSignInOutput', () => {
  it('maps a factor selection step to a chooser with the usable factors', () => {
    const outcome = mapSignInOutput(
      { isSignedIn: false, nextStep: { signInStep: 'CONTINUE_SIGN_IN_WITH_FIRST_FACTOR_SELECTION', availableChallenges: ['PASSWORD', 'WEB_AUTHN'] } },
      ALL_ENV,
    )
    expect(outcome).toEqual({ kind: 'challenge', step: { kind: 'chooseFactor', factors: ['WEB_AUTHN', 'PASSWORD'] } })
  })

  it('maps password, email code and new-password steps', () => {
    const map = (signInStep: string) => mapSignInOutput({ isSignedIn: false, nextStep: { signInStep } }, ALL_ENV)
    expect(map('CONFIRM_SIGN_IN_WITH_PASSWORD')).toEqual({ kind: 'challenge', step: { kind: 'password' } })
    expect(map('CONFIRM_SIGN_IN_WITH_EMAIL_CODE')).toEqual({ kind: 'challenge', step: { kind: 'emailCode' } })
    expect(map('CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED')).toEqual({ kind: 'challenge', step: { kind: 'newPassword' } })
  })

  it('reports done when Amplify says the user is signed in', () => {
    expect(mapSignInOutput({ isSignedIn: true, nextStep: { signInStep: 'DONE' } }, ALL_ENV)).toEqual({ kind: 'done' })
  })

  it('throws for a step this app does not offer (for example TOTP)', () => {
    expect(() => mapSignInOutput({ isSignedIn: false, nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE' } }, ALL_ENV)).toThrow(
      UnsupportedSignInStepError,
    )
  })
})

describe('stateAfterOutcome', () => {
  it('offers the passkey prompt after a password sign-in when it is allowed', () => {
    expect(stateAfterOutcome({ kind: 'done' }, 'a@b.c', false, true)).toEqual({ status: 'signedIn', promptPasskey: true })
  })

  it('never offers the passkey prompt right after a passkey sign-in', () => {
    expect(stateAfterOutcome({ kind: 'done' }, 'a@b.c', true, true)).toEqual({ status: 'signedIn', promptPasskey: false })
  })

  it('does not offer it once the prompt was dismissed', () => {
    expect(stateAfterOutcome({ kind: 'done' }, 'a@b.c', false, false)).toEqual({ status: 'signedIn', promptPasskey: false })
  })

  it('keeps the email and step while a challenge is pending', () => {
    expect(stateAfterOutcome({ kind: 'challenge', step: { kind: 'password' } }, 'a@b.c', false, true)).toEqual({
      status: 'challenge',
      email: 'a@b.c',
      step: { kind: 'password' },
    })
  })
})

describe('describeAuthError', () => {
  it('shows the pre sign-up trigger message from a validation error', () => {
    const error = new Error('PreSignUp failed with error Sign-up is currently disabled.')
    error.name = 'UserLambdaValidationException'
    expect(describeAuthError(error)).toBe('Sign-up is currently disabled.')
  })

  it('drops the extra period Cognito appends to the trigger message', () => {
    const error = new Error('PreSignUp failed with error Sign-up is limited to these email domains: example.com..')
    error.name = 'UserLambdaValidationException'
    expect(describeAuthError(error)).toBe('Sign-up is limited to these email domains: example.com.')
  })

  it('gives the same text for unknown users and wrong passwords', () => {
    const wrong = Object.assign(new Error('x'), { name: 'NotAuthorizedException' })
    const unknown = Object.assign(new Error('x'), { name: 'UserNotFoundException' })
    expect(describeAuthError(wrong)).toBe(describeAuthError(unknown))
  })
})
