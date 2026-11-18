import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBootstrap } from '../api/bootstrap'
import { useOverlayHints } from '../api/hint-overlay'
import { seenHints, useMarkHint } from '../api/hints'
import type { HintId } from '../api/types'
import { mergeHints } from './hints'

// Which beginner tips this person has seen, and a way to mark one seen. Marking is safe to call twice.
export function useHints() {
  const client = useQueryClient()
  const { data } = useBootstrap()
  const overlay = useOverlayHints(data?.me.email ?? '')
  const { mutate } = useMarkHint()
  const serverHints = data?.me.hints
  const seen = useMemo(() => mergeHints(serverHints ?? [], overlay), [serverHints, overlay])
  // Before the first load nothing is known, so nothing is shown.
  const isKnown = data !== undefined

  const markSeen = useCallback(
    (hint: HintId) => {
      if (!seenHints(client).includes(hint)) mutate(hint)
    },
    [client, mutate],
  )

  return { seen, isKnown, markSeen }
}
