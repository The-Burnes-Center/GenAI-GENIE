import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { Button, Dialog, DialogFooter } from '../ui'

// Blocks in-app navigation and tab close while a form has unsaved changes.
export function useUnsavedGuard(isDirty: boolean) {
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const dialog = (
    <Dialog
      title="Leave without saving?"
      isOpen={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset()
      }}
    >
      <p className="text-ink-2">You have changes that are not saved. If you leave now, they will be lost.</p>
      <DialogFooter>
        <Button autoFocus onPress={() => blocker.state === 'blocked' && blocker.reset()}>Stay</Button>
        <Button variant="danger" onPress={() => blocker.state === 'blocked' && blocker.proceed()}>Leave</Button>
      </DialogFooter>
    </Dialog>
  )
  return { dialog }
}
