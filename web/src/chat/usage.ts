import type { DailyUsage } from '../api/types'

// A hint appears once 80% of the day's messages are used.
const NEAR_LIMIT_FRACTION = 0.8

export interface UsageState {
  isLimited: boolean
  isNearLimit: boolean
  remaining: number
}

export function usageState(usage: DailyUsage | undefined): UsageState {
  if (!usage || usage.limit <= 0) return { isLimited: false, isNearLimit: false, remaining: Number.POSITIVE_INFINITY }
  const remaining = Math.max(0, usage.limit - usage.used)
  return {
    isLimited: remaining === 0,
    isNearLimit: remaining > 0 && usage.used >= usage.limit * NEAR_LIMIT_FRACTION,
    remaining,
  }
}

export function remainingText(remaining: number): string {
  return remaining === 1 ? 'You have 1 message left today.' : `You have ${remaining} messages left today.`
}
