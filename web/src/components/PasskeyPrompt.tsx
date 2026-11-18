import { Fingerprint } from '@phosphor-icons/react'
import { useAuth } from '../auth/use-auth'
import { Button, toast } from './ui'
import { useAsyncAction } from './use-async-action'

// Offered once after a password or email-code sign-in. A non-modal card: it never steals focus or blocks.
export function PasskeyPrompt() {
  const { state, enrollPasskey, dismissPasskeyPrompt } = useAuth()
  const { busy, error, run } = useAsyncAction()

  if (state.status !== 'signedIn' || !state.promptPasskey) return null

  return (
    <section
      role="region"
      aria-labelledby="passkey-prompt-title"
      className="ui-toast fixed bottom-4 left-4 right-4 z-[55] grid gap-2.5 rounded-xl border border-edge-strong bg-raised p-4 shadow-pop sm:left-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
    >
      <h2 id="passkey-prompt-title" className="flex items-center gap-2 text-body font-semibold">
        <Fingerprint size={20} className="text-accent" aria-hidden="true" />
        Add a passkey
      </h2>
      <p className="text-ink-2">
        Sign in with Face ID, Touch ID or a security key instead of a password.
      </p>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          isPending={busy}
          pendingLabel="Waiting for your device"
          onPress={() => void run(async () => {
            await enrollPasskey()
            toast.show('Passkey added. Next time, choose Sign in with a passkey.')
          })}
        >
          Set up a passkey
        </Button>
        <Button size="sm" onPress={() => dismissPasskeyPrompt()}>Not now</Button>
        <Button variant="ghost" size="sm" onPress={() => dismissPasskeyPrompt({ forever: true })}>Don't ask again</Button>
      </div>
    </section>
  )
}
