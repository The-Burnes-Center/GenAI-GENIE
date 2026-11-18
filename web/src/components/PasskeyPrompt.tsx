import { useState, type KeyboardEvent } from 'react'
import { Fingerprint } from '@phosphor-icons/react'
import { useAuth } from '../auth/use-auth'
import { useHints } from '../chat/use-hints'
import { Button, toast } from './ui'
import { useAsyncAction } from './use-async-action'

// Offered once after a password or email-code sign-in, as a slim bar at the top of the page. It sits in the
// page flow, so it can never cover the message box or any button, and it never takes focus.
// Never in a person's first session: it shows only if the welcome card was already done when this session
// began, which means they finished first-run on an earlier visit. That is read once and not revisited.
export function PasskeyPrompt() {
  const { state, enrollPasskey, dismissPasskeyPrompt } = useAuth()
  const { busy, error, run } = useAsyncAction()
  const { seen } = useHints()
  const [isReturning] = useState(() => seen.includes('welcome'))

  if (state.status !== 'signedIn' || !state.promptPasskey || !isReturning) return null

  // Escape counts as "Not now" while focus is in the bar.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    dismissPasskeyPrompt()
  }

  return (
    <section
      role="region"
      aria-labelledby="passkey-prompt-title"
      onKeyDown={onKeyDown}
      className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge bg-sunken px-4 py-2 md:px-8"
    >
      <p className="flex min-w-0 flex-1 basis-64 items-start gap-2 text-ui text-ink-2">
        <Fingerprint size={20} className="mt-px shrink-0 text-accent" aria-hidden="true" />
        <span>
          <b id="passkey-prompt-title" className="font-semibold text-ink">Add a passkey.</b> Sign in with Face ID, Touch ID or a security key instead of a password.
        </span>
      </p>
      {error && <p role="alert" className="basis-full text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          className="pointer-coarse:min-h-11!"
          isPending={busy}
          pendingLabel="Waiting for your device"
          onPress={() => void run(async () => {
            await enrollPasskey()
            toast.show('Passkey added. Next time, choose Sign in with a passkey.')
          })}
        >
          Set up a passkey
        </Button>
        <Button size="sm" className="pointer-coarse:min-h-11!" onPress={() => dismissPasskeyPrompt()}>Not now</Button>
        <Button variant="ghost" size="sm" className="pointer-coarse:min-h-11!" onPress={() => dismissPasskeyPrompt({ forever: true })}>Don't ask again</Button>
      </div>
    </section>
  )
}
