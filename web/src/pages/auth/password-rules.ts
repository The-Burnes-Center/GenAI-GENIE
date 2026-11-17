// Cognito enforces the full policy. These rules mirror it so the screen can explain what is missing.
export const MIN_PASSWORD_LENGTH = 8

export interface PasswordRule {
  label: string
  isMet: boolean
}

export function passwordRules(value: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', isMet: value.length >= MIN_PASSWORD_LENGTH },
    { label: 'An uppercase and a lowercase letter', isMet: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { label: 'A number', isMet: /\d/.test(value) },
  ]
}

export function isPasswordValid(value: string): boolean {
  return passwordRules(value).every((rule) => rule.isMet)
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmailValid(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

export function isSixDigitCode(value: string): boolean {
  return /^\d{6}$/.test(value)
}

export function domainMessage(domains: string[]): string {
  const list = domains.map((domain) => `@${domain}`).join(' or ')
  return `Genie accounts are for staff with an ${list} email. Use your work email, or ask your administrator for an invitation.`
}

export function isDomainAllowed(email: string, domains: string[]): boolean {
  if (domains.length === 0) return true
  const address = email.toLowerCase()
  return domains.some((domain) => address.endsWith(`@${domain.toLowerCase()}`))
}
