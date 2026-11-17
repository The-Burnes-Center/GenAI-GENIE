import { WifiSlash } from '@phosphor-icons/react'
import { useOnlineStatus } from './use-online-status'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 font-medium text-warn-soft-ink">
      <WifiSlash size={20} aria-hidden="true" />
      <span>You're offline. Genie will reconnect on its own.</span>
    </div>
  )
}
