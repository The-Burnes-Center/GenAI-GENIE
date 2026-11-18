import { useCallback, useState } from 'react'
import { useRewrite } from '../api/assist'

export type HelpState = 'closed' | 'loading' | 'ready' | 'error'

// State for the "Help me ask" panel. The text it works on is fixed when it opens, so editing the box meanwhile
// does not change what was asked. Closing while a call is in flight drops its result.
export function useHelpMeAsk() {
  const rewrite = useRewrite()
  const { mutate, reset } = rewrite
  const [isOpen, setIsOpen] = useState(false)
  const [source, setSource] = useState('')

  const start = useCallback(
    (draft: string) => {
      const text = draft.trim()
      setSource(text)
      setIsOpen(true)
      mutate(text)
    },
    [mutate],
  )
  const close = useCallback(() => {
    setIsOpen(false)
    reset()
  }, [reset])
  const retry = useCallback(() => mutate(source), [mutate, source])

  let state: HelpState = 'closed'
  if (isOpen) state = rewrite.isPending ? 'loading' : rewrite.isError ? 'error' : rewrite.data ? 'ready' : 'loading'

  return { state, isOpen, result: rewrite.data, error: rewrite.error, start, close, retry }
}
