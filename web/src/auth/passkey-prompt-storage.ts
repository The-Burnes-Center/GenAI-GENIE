// The passkey prompt is one-time. Remembering the dismissal is a per-browser convenience only.
const STORAGE_KEY = 'genie-passkey-prompt-dismissed'

export function isPasskeyPromptDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markPasskeyPromptDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage is unavailable (private window): the prompt may show again next visit.
  }
}
