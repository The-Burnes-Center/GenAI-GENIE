import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '../auth/use-auth'
import { describeAuthError } from '../auth/auth-errors'
import { MockAuthProvider } from './MockAuthProvider'
import { resetMockForTests } from './test-utils'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient()
  return (
    <QueryClientProvider client={client}>
      <MockAuthProvider>{children}</MockAuthProvider>
    </QueryClientProvider>
  )
}

function setup() {
  return renderHook(() => useAuth(), { wrapper })
}

// Runs one async step, then returns whatever error it threw (or null).
async function attempt(step: () => Promise<unknown>): Promise<Error | null> {
  let failure: Error | null = null
  await act(async () => {
    try {
      await step()
    } catch (error) {
      failure = error as Error
    }
  })
  return failure
}

describe('MockAuthProvider state transitions', () => {
  beforeEach(() => {
    resetMockForTests()
  })

  it('moves a standard email to the factor choice', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.startSignIn('a@example.org')
    })
    expect(result.current.state).toMatchObject({
      status: 'challenge',
      email: 'a@example.org',
      step: { kind: 'chooseFactor', factors: ['WEB_AUTHN', 'PASSWORD', 'EMAIL_OTP'] },
    })
  })

  it('goes straight to the password step for nopasskey accounts', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.startSignIn('nopasskey@example.org')
    })
    expect(result.current.state).toMatchObject({ status: 'challenge', step: { kind: 'password' } })
  })

  it('asks for a new password for invited accounts', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.startSignIn('invited@example.org')
    })
    expect(result.current.state).toMatchObject({ status: 'challenge', step: { kind: 'newPassword' } })
  })

  it('shows the suspended screen for suspended accounts', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.startSignIn('suspended@example.org')
    })
    expect(result.current.state).toEqual({ status: 'suspended', email: 'suspended@example.org' })
  })

  it('rejects a wrong password with NotAuthorizedException and keeps the challenge', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.startSignIn('nopasskey@example.org')
    })
    const failure = await attempt(() => result.current.submitChallenge('wrong'))
    expect(failure?.name).toBe('NotAuthorizedException')
    expect(describeAuthError(failure)).toBe('Email or password is incorrect.')
    expect(result.current.state).toMatchObject({ status: 'challenge', step: { kind: 'password' } })
  })

  it('signs in with the right password, saves the session and reports signed in', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.startSignIn('nopasskey@example.org')
    })
    await act(async () => {
      await result.current.submitChallenge('correct-horse')
    })
    expect(result.current.state).toMatchObject({ status: 'signedIn' })
    await expect(result.current.getIdToken()).resolves.toBe('mock-token')
  })

  it('rejects a wrong email code with CodeMismatchException', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.startSignIn('a@example.org')
    })
    await act(async () => {
      await result.current.chooseFactor('EMAIL_OTP')
    })
    const failure = await attempt(() => result.current.submitChallenge('000000'))
    expect(failure?.name).toBe('CodeMismatchException')
  })

  it('refuses sign-up outside the allowed domains with the friendly PreSignUp message', async () => {
    const { result } = setup()
    const failure = await attempt(() => result.current.signUp('someone@gmail.com', 'correct-horse'))
    expect(failure?.name).toBe('UserLambdaValidationException')
    expect(describeAuthError(failure)).toBe(
      'Genie accounts are for staff with an @example.org or @example.gov email. Use your work email, or ask your administrator for an invitation.',
    )
  })

  it('lets a staff email sign up and finish with a manual sign-in', async () => {
    const { result } = setup()
    let sent = false
    await act(async () => {
      sent = await result.current.signUp('new.person@example.org', 'correct-horse')
    })
    expect(sent).toBe(true)
    let autoSignedIn = true
    await act(async () => {
      autoSignedIn = await result.current.finishSignUp('new.person@example.org', '123456')
    })
    expect(autoSignedIn).toBe(false)
  })
})
