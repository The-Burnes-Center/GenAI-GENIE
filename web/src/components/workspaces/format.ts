const KILOBYTE = 1000
const MEGABYTE = 1_000_000

export function formatSize(bytes: number): string {
  if (bytes >= MEGABYTE) return `${Number((bytes / MEGABYTE).toFixed(1))} MB`
  return `${Math.max(1, Math.round(bytes / KILOBYTE))} KB`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
