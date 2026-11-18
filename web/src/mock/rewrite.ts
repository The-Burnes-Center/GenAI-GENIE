// Mock "Help me ask": a deterministic rewrite that adds only what is missing and says what it added.
import type { RewriteResponse } from '../api/types'

const HAS_AUDIENCE = /\b(?:for (?:a|an|the|my|our)\b|audience|reader|resident|staff|manager|who will read)/i
const HAS_BACKGROUND = /\b(?:background|context|because|so that|they asked|the situation)\b/i
const HAS_FORMAT = /\b(?:bullet|list|table|email|paragraph|words|sentences|steps|summary|memo|letter|agenda)\b/i
const LONG_ENOUGH_FOR_BACKGROUND = 220

function sentence(text: string): string {
  const trimmed = text.trim()
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.?!]$/.test(capped) ? capped : `${capped}.`
}

export function mockRewrite(text: string): RewriteResponse {
  const parts = [sentence(text)]
  const changes: string[] = []
  if (!HAS_AUDIENCE.test(text)) {
    parts.push('It is for [who will read this].')
    changes.push('A blank for who it is for')
  }
  if (!HAS_BACKGROUND.test(text) && text.length < LONG_ENOUGH_FOR_BACKGROUND) {
    parts.push('Background: [what the reader already knows, and any rules or facts that apply].')
    changes.push('A blank for background to use')
  }
  if (!HAS_FORMAT.test(text)) {
    parts.push('Format: [for example, a short email or 3 bullet points].')
    changes.push('Asked for a format and length')
  }
  parts.push('Use plain language. If you are not sure about something, say so.')
  changes.push('Plain language, and say when unsure')
  return { text: parts.join('\n\n'), changes }
}
