// Stand-in for AuthProvider in mock mode. Same AuthContextValue, no Cognito: the state machine is the real one.
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext } from '../auth/auth-context-object'
import type { AuthContextValue, PasskeyInfo } from '../auth/AuthContext'
import { stateAfterOutcome, type AuthState, type FirstFactor } from '../auth/auth-machine'
import { passkeysSupported } from '../auth/auth-service'
import { isPasskeyPromptDismissed, markPasskeyPromptDismissed } from '../auth/passkey-prompt-storage'
import { MOCK_TOKEN, readMockSignIn, writeMockSignIn } from './identity'
import {
  addMockPasskey,
  checkEmailCode,
  checkPassword,
  checkSignUpEmail,
  isSixDigitCode,
  listMockPasskeys,
  mockAuthError,
  planStartSignIn,
  removeMockPasskey,
  signedInStatus,
} from './mock-auth-rules'
import { mockTiming, randomInRange, sleep } from './timing'

const SIGNED_OUT: AuthState = { status: 'signedOut' }

function initialState(): AuthState {
  return readMockSignIn() ? { status: 'signedIn', promptPasskey: false } : SIGNED_OUT
}

function passkeyPromptAllowed(): boolean {
  return passkeysSupported() && !isPasskeyPromptDismissed()
}

// Every mock call waits like a network request would.
function pause(): Promise<void> {
  return sleep(randomInRange(mockTiming.authDelayMs))
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>(initialState)

  const finishSignIn = useCallback((email: string, viaPasskey: boolean) => {
    writeMockSignIn({ email, status: signedInStatus(email) })
    setState(stateAfterOutcome({ kind: 'done' }, email, viaPasskey, passkeyPromptAllowed()))
  }, [])

  const startSignIn = useCallback(async (email: string) => {
    await pause()
    const plan = planStartSignIn(email)
    if (plan.kind === 'suspended') setState({ status: 'suspended', email })
    else setState({ status: 'challenge', email, step: plan.step })
  }, [])

  const chooseFactor = useCallback(
    async (factor: FirstFactor) => {
      if (state.status !== 'challenge') throw new Error('No sign-in is in progress.')
      const { email } = state
      await pause()
      if (factor === 'WEB_AUTHN') return finishSignIn(email, true)
      const step = factor === 'EMAIL_OTP' ? { kind: 'emailCode' as const } : { kind: 'password' as const }
      setState({ status: 'challenge', email, step })
    },
    [state, finishSignIn],
  )

  const submitChallenge = useCallback(
    async (value: string) => {
      if (state.status !== 'challenge') throw new Error('No sign-in is in progress.')
      const { email, step } = state
      await pause()
      if (step.kind === 'password') checkPassword(value)
      else if (step.kind === 'emailCode') checkEmailCode(value)
      else if (step.kind === 'chooseFactor') throw new Error('Choose a sign-in method first.')
      finishSignIn(email, false)
    },
    [state, finishSignIn],
  )

  const enrollPasskey = useCallback(async () => {
    await pause()
    addMockPasskey()
    markPasskeyPromptDismissed()
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, promptPasskey: false } : prev))
  }, [])

  const dismissPasskeyPrompt = useCallback(() => {
    markPasskeyPromptDismissed()
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, promptPasskey: false } : prev))
  }, [])

  const signOut = useCallback(async () => {
    await pause()
    writeMockSignIn(null)
    queryClient.clear()
    setState(SIGNED_OUT)
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      startSignIn,
      chooseFactor,
      submitChallenge,
      cancelSignIn: () => setState(SIGNED_OUT),
      signUp: async (email) => {
        await pause()
        checkSignUpEmail(email)
        return true
      },
      finishSignUp: async (_email, code) => {
        await pause()
        // Any six digits confirm the account; the user then signs in by hand, as with a manual confirmation.
        if (!isSixDigitCode(code)) throw mockAuthError('CodeMismatchException', 'Invalid verification code provided, please try again.')
        return false
      },
      forgotPassword: async () => {
        await pause()
      },
      confirmForgotPassword: async (_email, code) => {
        await pause()
        checkEmailCode(code)
      },
      enrollPasskey,
      listPasskeys: async (): Promise<PasskeyInfo[]> => {
        await pause()
        return listMockPasskeys()
      },
      removePasskey: async (credentialId) => {
        await pause()
        removeMockPasskey(credentialId)
      },
      changePassword: async (oldPassword) => {
        await pause()
        checkPassword(oldPassword)
      },
      dismissPasskeyPrompt,
      signOut,
      getIdToken: async () => (readMockSignIn() ? MOCK_TOKEN : null),
    }),
    [state, startSignIn, chooseFactor, submitChallenge, enrollPasskey, dismissPasskeyPrompt, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
