import type { HintId } from '../api/types'

// Every id the server knows. `satisfies Record<HintId, true>` makes the compiler reject a missing or extra one.
const HINT_FLAGS = { welcome: true, 'think-harder': true, compare: true, workspaces: true, templates: true, attach: true, refine: true } satisfies Record<HintId, true>
export const HINT_IDS = Object.keys(HINT_FLAGS) as HintId[]

// Adds a hint without changing the list it came from, and without duplicates.
export function withHint(hints: HintId[], hint: HintId): HintId[] {
  return hints.includes(hint) ? hints : [...hints, hint]
}

export function mergeHints(a: HintId[], b: HintId[]): HintId[] {
  return b.reduce(withHint, a)
}

interface NextTipInput {
  seen: HintId[]
  // Tips that fit what is on screen, most useful first.
  eligible: HintId[]
  // While the welcome card shows, no tip does.
  isWelcomeVisible: boolean
  // Tips never appear mid-answer or while a menu is open.
  isBusy?: boolean
}

// At most one tip at a time: the first eligible tip the person has not seen, or none.
export function nextTip({ seen, eligible, isWelcomeVisible, isBusy = false }: NextTipInput): HintId | null {
  if (isWelcomeVisible || isBusy) return null
  return eligible.find((hint) => hint !== 'welcome' && !seen.includes(hint)) ?? null
}

export interface TipCopy {
  title: string
  body: string
  // Where the feature lives, for tips about the sidebar pages.
  link?: { to: string; label: string }
}

// Each tip says what the feature does and when to use it, in plain words.
export const TIP_COPY: Record<Exclude<HintId, 'welcome' | 'refine'>, TipCopy> = {
  attach: {
    title: 'Attach a file',
    body: 'Add a PDF, a Word file or a photo and Genie reads it. Good for summaries and plain-language rewrites.',
  },
  'think-harder': {
    title: 'Think harder',
    body: 'Slower, but better on tricky questions, like rules with many steps or long documents. Turn it on in the box below.',
  },
  compare: {
    title: 'Compare',
    body: 'Send one request to 2 or 3 models and read the answers side by side. Handy when the answer matters.',
    link: { to: '/compare', label: 'Open Compare' },
  },
  workspaces: {
    title: 'Workspaces',
    body: 'A workspace is a shared folder of your team’s documents. Genie can search it and cite where each point came from.',
    link: { to: '/workspaces', label: 'Open Workspaces' },
  },
  templates: {
    title: 'Templates',
    body: 'Not sure how to start? Pick a template. It fills the box with a ready-made request to edit.',
    link: { to: '/templates', label: 'Browse templates' },
  },
}

export const REFINE_TIP = 'Tap one, or type your own change. No need to start over.'
