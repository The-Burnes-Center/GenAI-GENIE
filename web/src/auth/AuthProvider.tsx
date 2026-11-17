import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext } from './auth-context-object'
import type { AuthContextValue, PasskeyInfo } from './AuthContext'
import { isUserDisabledError } from './auth-errors'
import { stateAfterOutcome, type AuthState, type FirstFactor, type SignInOutcome } from './auth-machine'
import {
  changePassword,
  confirmAccount,
  confirmPasswordReset,
  currentFactorEnv,
  endSession,
  enrollPasskey,
  getIdToken,
  hasActiveSession,
  listAllPasskeys,
  passkeysSupported,
  requestPasswordReset,
  removePasskey,
  respondToChallenge,
  signUpAccount,
  startSignIn,
} from './auth-service'
import { isPasskeyPromptDismissed, markPasskeyPromptDismissed } from './passkey-prompt-storage'

const SIGNED_OUT: AuthState = { status: 'signedOut' }

function passkeyPromptAllowed(): boolean {
  return passkeysSupported() && !isPasskeyPromptDismissed()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    void hasActiveSession().then((signedIn) => {
      if (active) setState(signedIn ? { status: 'signedIn', promptPasskey: false } : SIGNED_OUT)
    })
    return () => {
      active = false
    }
  }, [])

  const applyOutcome = useCallback((outcome: SignInOutcome, email: string, viaPasskey: boolean) => {
    setState(stateAfterOutcome(outcome, email, viaPasskey, passkeyPromptAllowed()))
  }, [])

  // A disabled account moves to the suspended screen instead of showing a form error.
  const guardDisabled = useCallback(async (email: string, step: () => Promise<void>) => {
    try {
      await step()
    } catch (error) {
      if (!isUserDisabledError(error)) throw error
      setState({ status: 'suspended', email })
    }
  }, [])

  const startSignInFlow = useCallback(
    (email: string) =>
      guardDisabled(email, async () => {
        const outcome = await startSignIn(email, currentFactorEnv())
        applyOutcome(outcome, email, false)
      }),
    [applyOutcome, guardDisabled],
  )

  const chooseFactor = useCallback(
    async (factor: FirstFactor) => {
      if (state.status !== 'challenge') throw new Error('No sign-in is in progress.')
      await guardDisabled(state.email, async () => {
        const outcome = await respondToChallenge(factor, currentFactorEnv())
        applyOutcome(outcome, state.email, factor === 'WEB_AUTHN')
      })
    },
    [state, applyOutcome, guardDisabled],
  )

  const submitChallenge = useCallback(
    async (value: string) => {
      if (state.status !== 'challenge') throw new Error('No sign-in is in progress.')
      await guardDisabled(state.email, async () => {
        const outcome = await respondToChallenge(value, currentFactorEnv())
        applyOutcome(outcome, state.email, false)
      })
    },
    [state, applyOutcome, guardDisabled],
  )

  const cancelSignIn = useCallback(() => setState(SIGNED_OUT), [])

  const signUp = useCallback((email: string, password: string) => signUpAccount(email, password), [])

  const listPasskeys = useCallback(async (): Promise<PasskeyInfo[]> => {
    const credentials = await listAllPasskeys()
    return credentials.map((c) => ({
      credentialId: c.credentialId ?? '',
      name: c.friendlyCredentialName ?? 'Passkey',
      createdAt: c.createdAt,
    }))
  }, [])

  const finishSignUp = useCallback(
    async (email: string, code: string) => {
      const result = await confirmAccount(email, code, currentFactorEnv())
      if (result.kind === 'manualSignIn') return false
      applyOutcome(result.outcome, email, false)
      return true
    },
    [applyOutcome],
  )

  const enrollPasskeyAndClose = useCallback(async () => {
    await enrollPasskey()
    markPasskeyPromptDismissed()
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, promptPasskey: false } : prev))
  }, [])

  const dismissPasskeyPrompt = useCallback((options?: { forever?: boolean }) => {
    if (options?.forever) markPasskeyPromptDismissed()
    setState((prev) => (prev.status === 'signedIn' ? { ...prev, promptPasskey: false } : prev))
  }, [])

  const signOut = useCallback(async () => {
    await endSession()
    queryClient.clear()
    setState(SIGNED_OUT)
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      startSignIn: startSignInFlow,
      chooseFactor,
      submitChallenge,
      cancelSignIn,
      signUp,
      finishSignUp,
      forgotPassword: requestPasswordReset,
      confirmForgotPassword: confirmPasswordReset,
      enrollPasskey: enrollPasskeyAndClose,
      listPasskeys,
      removePasskey,
      changePassword,
      dismissPasskeyPrompt,
      signOut,
      getIdToken,
    }),
    [state, startSignInFlow, chooseFactor, submitChallenge, cancelSignIn, signUp, listPasskeys, finishSignUp, enrollPasskeyAndClose, dismissPasskeyPrompt, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
