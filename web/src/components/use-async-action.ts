import { useCallback, useState } from 'react'
import { describeAuthError } from '../auth/auth-errors'

// Runs one user action at a time and keeps its friendly error text.
export function useAsyncAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(describeAuthError(caught))
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, run, setError }
}
