export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Audit details are a small object. Show the note when there is one, else "key: value" pairs.
export function summarizeDetails(details?: Record<string, unknown>): string {
  if (!details) return ''
  if (typeof details.note === 'string') return details.note
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(', ')
}
