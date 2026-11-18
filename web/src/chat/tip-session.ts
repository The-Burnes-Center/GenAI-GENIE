import type { HintId } from '../api/types'

// One piece of guidance per app session (a page load): the welcome card, or one feature tip. Without this,
// a new person who dismisses a tip would meet the next one straight away, four times in a row.
let claimed: HintId | null = null

// A tip may show if nothing has claimed this session, or if it is the one that did.
export function canShowTip(hint: HintId): boolean {
  return claimed === null || claimed === hint
}

export function claimTip(hint: HintId): void {
  if (claimed === null) claimed = hint
}

export function resetTipSession(): void {
  claimed = null
}
