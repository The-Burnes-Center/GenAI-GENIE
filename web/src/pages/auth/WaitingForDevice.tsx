import { Fingerprint } from '@phosphor-icons/react'
import { Button } from '../../components/ui'
import { StatusScreen } from './AuthLayout'

export function WaitingForDevice({ onCancel }: { onCancel: () => void }) {
  return (
    <StatusScreen
      role="status"
      icon={<Fingerprint />}
      title="Waiting for your device"
      actions={<Button onPress={onCancel}>Cancel</Button>}
    >
      Follow the prompt from your browser to use Face ID, Touch ID or your security key.
    </StatusScreen>
  )
}
