// [Bracketed] parts in a starter or suggested request are blanks for the person to fill in.
const PLACEHOLDER = /\[[^\]\n]{1,80}\]/g

export interface TextPart {
  text: string
  isPlaceholder: boolean
}

export function splitPlaceholders(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start), isPlaceholder: false })
    parts.push({ text: match[0], isPlaceholder: true })
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), isPlaceholder: false })
  return parts
}

export function countPlaceholders(text: string): number {
  return text.match(PLACEHOLDER)?.length ?? 0
}

export interface Range {
  start: number
  end: number
}

// The first blank at or after `from`, wrapping to the first one. Null when there are none.
export function nextPlaceholder(text: string, from: number): Range | null {
  const ranges = [...text.matchAll(PLACEHOLDER)].map((match) => ({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }))
  if (ranges.length === 0) return null
  return ranges.find((range) => range.start >= from) ?? ranges[0]
}

// Selects a blank in a textarea so typing replaces it. Focuses the box unless told not to.
export function selectNextPlaceholder(box: HTMLTextAreaElement, from: number, shouldFocus = true): boolean {
  const range = nextPlaceholder(box.value, from)
  if (!range) return false
  if (shouldFocus) box.focus()
  box.setSelectionRange(range.start, range.end)
  return true
}
