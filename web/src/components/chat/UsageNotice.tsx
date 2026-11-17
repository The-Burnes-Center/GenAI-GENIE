import { InlineNotice } from '../ui'
import { formatResetTime } from '../../chat/error-copy'
import { remainingText, usageState } from '../../chat/usage'
import type { DailyUsage } from '../../api/types'

// At the limit: a warning with the local reset time. Near it: one quiet line. Otherwise nothing.
export function UsageNotice({ usage }: { usage: DailyUsage | undefined }) {
  const state = usageState(usage)
  if (!usage) return null
  if (state.isLimited) {
    return (
      <InlineNotice tone="warn">
        <b className="font-medium">You’ve reached today’s limit of {usage.limit} messages.</b> It starts over {formatResetTime(usage.resetsAt)}. Ask your
        administrator if you need more. You can still read your chats.
      </InlineNotice>
    )
  }
  if (state.isNearLimit) return <p className="text-center text-small text-ink-2">{remainingText(state.remaining)}</p>
  return null
}
