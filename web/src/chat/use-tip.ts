import { useEffect } from 'react'
import type { HintId } from '../api/types'
import { nextTip } from './hints'
import { canShowTip, claimTip } from './tip-session'
import { useHints } from './use-hints'

interface TipOptions {
  isWelcomeVisible: boolean
  isBusy?: boolean
}

// The one tip to show right now, if any. Dismissing marks it seen, and so does using the feature.
// Feature tips are paced: one per app session, and none in a session that showed the welcome card. The
// "change this answer" hint (`refine`) sits inside the answer helpers and is not held back by that.
export function useFeatureTip(eligible: HintId[], { isWelcomeVisible, isBusy }: TipOptions) {
  const { seen, isKnown, markSeen } = useHints()
  const candidate = isKnown ? nextTip({ seen, eligible, isWelcomeVisible, isBusy }) : null
  const tip = candidate && (candidate === 'refine' || canShowTip(candidate)) ? candidate : null

  useEffect(() => {
    if (tip && tip !== 'refine') claimTip(tip)
  }, [tip])

  return { tip, markSeen, dismiss: () => tip && markSeen(tip) }
}

// For pages that are the feature itself: opening the page counts as having seen its tip.
export function useMarkSeenOnVisit(hint: HintId): void {
  const { isKnown, markSeen } = useHints()
  useEffect(() => {
    if (isKnown) markSeen(hint)
  }, [isKnown, markSeen, hint])
}
