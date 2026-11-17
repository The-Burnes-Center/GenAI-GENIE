import { CheckCircle, Circle } from '@phosphor-icons/react'
import { passwordRules } from './password-rules'

// Live requirements list. Each line says "(done)" in words as well as changing color and icon.
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul aria-label="Password requirements" className="grid gap-1 text-small text-ink-2">
      {passwordRules(value).map((rule) => (
        <li key={rule.label} className={`flex items-center gap-2 ${rule.isMet ? 'text-ok-soft-ink' : ''}`}>
          {rule.isMet ? <CheckCircle size={16} aria-hidden="true" /> : <Circle size={16} className="text-ink-3" aria-hidden="true" />}
          <span>
            {rule.label}
            {rule.isMet ? ' (done)' : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
