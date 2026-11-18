import { describe, expect, it } from 'vitest'
import { assistBlockedReason } from './assist-state'

describe('assistBlockedReason', () => {
  it('asks for a rough idea first when the box is empty', () => {
    expect(assistBlockedReason('')).toBe('Type a rough idea first, then press Help me ask.')
    expect(assistBlockedReason('   ')).toBe('Type a rough idea first, then press Help me ask.')
  })

  it('asks for a few more words when there is too little', () => {
    expect(assistBlockedReason('snow plan')).toMatch(/few more words/)
  })

  it('says when it is too long, and is null when it can run', () => {
    expect(assistBlockedReason('word '.repeat(2000))).toMatch(/too long/)
    expect(assistBlockedReason('write an email about the snow ban')).toBeNull()
  })
})
