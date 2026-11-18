// The same rules the backend applies to settings (zod's email and an https-only link), so a value the form
// accepts is a value the server accepts, and a value stored from elsewhere never becomes a risky link.
const EMAIL = /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/

export function isEmail(value: string): boolean {
  return EMAIL.test(value)
}

export function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function mailtoHref(address: string): string {
  return `mailto:${encodeURIComponent(address)}`
}
