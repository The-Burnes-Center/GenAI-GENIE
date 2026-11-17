// Only in-app paths are honoured after sign-in, so the redirect cannot leave the site.
export function safeReturnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/home'
}
