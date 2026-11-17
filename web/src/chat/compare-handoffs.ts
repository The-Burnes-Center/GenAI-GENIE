import { createHandoffStore } from './chat-handoff'
import type { CompareTurn } from './compare-state'

export interface CompareHandoff {
  turns: CompareTurn[]
  modelIds: string[]
}

export const compareHandoffs = createHandoffStore<CompareHandoff>()
