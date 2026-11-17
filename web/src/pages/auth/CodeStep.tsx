import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, TextField } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { AuthCard, AuthHeading } from './AuthLayout'
import { isSixDigitCode } from './password-rules'

const CODE_ERROR = "That code didn't work. Check the six digits and try again."

interface CodeStepProps {
  title: string
  lead: ReactNode
  submitLabel: string
  onSubmit: (code: string) => Promise<void>
  // Optional: shows "Send a new code" when given.
  onResend?: () => Promise<void>
  // Fields shown under the code, for example the new password on the reset screen.
  extra?: ReactNode
  isSubmitDisabled?: boolean
}

// Six-digit one-time code form used by email sign-in, sign-up confirmation and password reset.
export function CodeStep({ title, lead, submitLabel, onSubmit, onResend, extra, isSubmitDisabled }: CodeStepProps) {
  const { busy, error, run } = useAsyncAction()
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = code.trim()
    if (!isSixDigitCode(value)) {
      setHint(CODE_ERROR)
      inputRef.current?.focus()
      return
    }
    setHint(null)
    void run(() => onSubmit(value))
  }

  return (
    <AuthCard as="form" onSubmit={submit}>
      <AuthHeading lead={lead}>{title}</AuthHeading>
      <TextField
        label="Six-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={setCode}
        autoFocus
        inputRef={inputRef}
        inputClassName="font-mono text-title tracking-[0.3em]"
        errorMessage={hint ?? error ?? undefined}
      />
      {extra}
      <Button type="submit" variant="primary" className="min-h-11" isPending={busy} pendingLabel="Checking" isDisabled={isSubmitDisabled}>
        {submitLabel}
      </Button>
      {onResend && (
        <p className="text-small">
          <Button variant="link" onPress={() => void onResend().then(() => setResent(true))}>Send a new code</Button>{' '}
          <span role="status" className="text-ink-3">{resent ? 'A new code is on its way.' : ''}</span>
        </p>
      )}
    </AuthCard>
  )
}
