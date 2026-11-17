import { Button } from '../../components/ui'

// "who am I signing in as" row with a Change link.
export function IdentityLine({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-edge-strong bg-surface px-3 py-2">
      <span className="min-w-0 truncate">{email}</span>
      <Button variant="link" onPress={onChange}>Change</Button>
    </div>
  )
}
