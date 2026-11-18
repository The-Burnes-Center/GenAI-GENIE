import { useSyncExternalStore } from 'react'
import type { HintId } from './types'

// Tips this person dismissed in this tab. They are merged over what the server says, so a refetch that
// arrives late, or a save that failed, cannot bring a dismissed tip back during the visit. The list belongs
// to one email, so signing in as someone else starts clean.
interface Overlay {
  owner: string
  hints: HintId[]
}

const NONE: Overlay = { owner: '', hints: [] }
let overlay: Overlay = NONE
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function addOverlayHint(owner: string, hint: HintId): void {
  const current = overlay.owner === owner ? overlay.hints : []
  if (current.includes(hint)) return
  overlay = { owner, hints: [...current, hint] }
  emit()
}

export function clearOverlay(): void {
  if (overlay === NONE) return
  overlay = NONE
  emit()
}

export function overlayFor(owner: string): HintId[] {
  return overlay.owner === owner ? overlay.hints : []
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): Overlay => overlay

export function useOverlayHints(owner: string): HintId[] {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return snapshot.owner === owner ? snapshot.hints : NONE.hints
}
