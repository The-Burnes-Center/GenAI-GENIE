import type { UiMessage } from './messages'

export interface Refinement {
  id: string
  label: string
  // Sent as the next message, in the person's voice.
  prompt: string
}

// Short follow-ups beginners would otherwise restart to get. Each one sends one plain sentence.
export const REFINEMENTS: Refinement[] = [
  { id: 'shorter', label: 'Shorter', prompt: 'Make it shorter.' },
  { id: 'simpler', label: 'Simpler words', prompt: 'Use simpler words. Aim for a 6th to 8th grade reading level.' },
  { id: 'detail', label: 'Add more detail', prompt: 'Add more detail.' },
  { id: 'list', label: 'Make it a list', prompt: 'Turn this into a bulleted list.' },
  { id: 'friendlier', label: 'Friendlier tone', prompt: 'Make the tone friendlier and warmer.' },
]

// Reads as something the person said, because it appears in their chat. It asks the model to critique its own
// answer and to name what to check.
export const CHECK_PROMPT =
  'What in your last answer might be wrong or out of date? List the names, numbers, dates and references I should check, and where to check them.'

export const CHECK_LABEL = 'What should I double-check?'

export const REFINE_LABEL = 'Change this answer'

export interface Cue {
  kind: 'dates' | 'numbers' | 'laws' | 'quotes'
  label: string
}

const CUE_PATTERNS: Array<{ kind: Cue['kind']; label: string; pattern: RegExp }> = [
  {
    kind: 'dates',
    label: 'dates',
    pattern:
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b|\b(?:19|20)\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\bdeadlines?\b/i,
  },
  { kind: 'numbers', label: 'numbers', pattern: /\$\s?\d|\b\d+(?:\.\d+)?\s?%|\b(?!(?:19|20)\d{2}\b)\d{2,}\b/ },
  {
    kind: 'laws',
    label: 'laws or rules',
    pattern: /§|\bsection\s+\d|\b(?:act|statute|regulation|ordinance|chapter|m\.g\.l\.|u\.s\.c\.|c\.f\.r\.|cfr)\b|\blaws?\b/i,
  },
  { kind: 'quotes', label: 'quotes', pattern: /["“][^"”\n]{20,}["”]/ },
]

// Code, list numbers and [1] source markers are not facts to check.
function plainProse(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^\s*(?:\d+[.)]|[-*+])\s+/gm, '')
    .replace(/\[\d+\]/g, ' ')
}

// What in this answer deserves a second look. Order is fixed so the sentence reads the same each time.
export function findCues(markdown: string): Cue[] {
  const prose = plainProse(markdown)
  return CUE_PATTERNS.filter(({ pattern }) => pattern.test(prose)).map(({ kind, label }) => ({ kind, label }))
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

export const GENERIC_CUE = 'Check anything you will send, sign or act on against the source.'

// The line under an answer. It names what is in this answer, then says what to do with it.
export function verifyLine(markdown: string, scope: 'one' | 'many' = 'one'): string {
  const cues = findCues(markdown)
  if (cues.length === 0) return GENERIC_CUE
  const subject = scope === 'many' ? 'These answers include' : 'This answer includes'
  return `${subject} ${joinWords(cues.map((cue) => cue.label))}. Check them against the source before you use them.`
}

// The assistant message the helpers belong to: the last one, finished, with text. Never while streaming or after an error.
export function helperTarget(messages: UiMessage[], isStreaming: boolean): UiMessage | undefined {
  if (isStreaming) return undefined
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return undefined
  return last.status === 'complete' && last.content.trim() !== '' && !last.contentUnavailable ? last : undefined
}

// Two or more things the person sent means they already know it is a conversation.
export function hasFollowedUp(messages: UiMessage[]): boolean {
  return messages.filter((message) => message.role === 'user').length >= 2
}
