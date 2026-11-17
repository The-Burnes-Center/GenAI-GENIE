import { useEffect, useSyncExternalStore } from 'react'
import { toast } from '../components/ui'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

// Shows the banner state and a toast when the connection returns.
export function useOnlineStatus(): boolean {
  const isOnline = useIsOnline()
  useEffect(() => {
    const onBack = () => toast.show("You're back online.")
    window.addEventListener('online', onBack)
    return () => window.removeEventListener('online', onBack)
  }, [])
  return isOnline
}
