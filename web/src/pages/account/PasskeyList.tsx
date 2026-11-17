import { useState } from 'react'
import { Fingerprint, Plus } from '@phosphor-icons/react'
import { describeAuthError } from '../../auth/auth-errors'
import type { PasskeyInfo } from '../../auth/AuthContext'
import { AlertDialog, Button, InlineNotice, SkeletonLines, toast } from '../../components/ui'
import { useAddPasskey, usePasskeys, useRemovePasskey } from './use-passkeys'

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function PasskeyList() {
  const passkeys = usePasskeys()
  const remove = useRemovePasskey()
  const add = useAddPasskey()
  const [pending, setPending] = useState<PasskeyInfo | null>(null)
  const items = passkeys.data ?? []

  async function addPasskey() {
    try {
      await add.mutateAsync()
      toast.show('Passkey added.')
    } catch (error) {
      toast.error(describeAuthError(error))
    }
  }

  async function removePending() {
    if (!pending) return
    try {
      await remove.mutateAsync(pending.credentialId)
      toast.show('Passkey removed.')
    } catch (error) {
      toast.error(describeAuthError(error))
    }
  }

  return (
    <>
      {passkeys.isPending && <SkeletonLines count={2} label="Loading passkeys" />}
      {passkeys.isError && <InlineNotice tone="bad" actions={<Button size="sm" onPress={() => void passkeys.refetch()}>Try again</Button>}>We could not load your passkeys.</InlineNotice>}
      {passkeys.isSuccess && items.length === 0 && (
        <p className="text-ink-3">You have no passkeys yet. Add one to sign in without typing a password.</p>
      )}
      {items.length > 0 && (
        <ul>
          {items.map((passkey) => (
            <li key={passkey.credentialId} className="flex items-center gap-3 border-b border-edge py-3 last:border-b-0">
              <Fingerprint size={20} className="text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <b className="block font-medium">{passkey.name}</b>
                {passkey.createdAt && <span className="text-small text-ink-3">Added {DATE_FORMAT.format(passkey.createdAt)}</span>}
              </div>
              <Button size="sm" aria-label={`Remove passkey ${passkey.name}`} onPress={() => setPending(passkey)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button isPending={add.isPending} pendingLabel="Waiting for your device" onPress={() => void addPasskey()}>
          <Plus size={16} aria-hidden="true" />
          Add a passkey
        </Button>
      </div>
      <AlertDialog
        title={`Remove "${pending?.name ?? ''}"?`}
        body={items.length === 1 ? 'It is your only passkey. You will sign in with your password instead.' : 'You will no longer be able to sign in with it.'}
        confirmLabel="Remove passkey"
        isOpen={pending !== null}
        onOpenChange={(isOpen) => !isOpen && setPending(null)}
        onConfirm={removePending}
      />
    </>
  )
}
