import { describe, expect, it } from 'vitest'
import { HINT_IDS, mergeHints, nextTip, withHint } from './hints'

describe('nextTip', () => {
  const eligible = ['attach', 'templates', 'compare'] as const

  it('returns the first eligible tip that has not been seen', () => {
    expect(nextTip({ seen: ['attach'], eligible: [...eligible], isWelcomeVisible: false })).toBe('templates')
  })

  it('shows at most one tip, even when several are unseen', () => {
    expect(nextTip({ seen: [], eligible: [...eligible], isWelcomeVisible: false })).toBe('attach')
  })

  it('shows none while the welcome card is showing', () => {
    expect(nextTip({ seen: [], eligible: [...eligible], isWelcomeVisible: true })).toBeNull()
  })

  it('shows none while busy, and none when everything is seen', () => {
    expect(nextTip({ seen: [], eligible: [...eligible], isWelcomeVisible: false, isBusy: true })).toBeNull()
    expect(nextTip({ seen: ['attach', 'templates', 'compare'], eligible: [...eligible], isWelcomeVisible: false })).toBeNull()
  })

  it('never offers the welcome hint as a tip', () => {
    expect(nextTip({ seen: [], eligible: ['welcome'], isWelcomeVisible: false })).toBeNull()
  })
})

describe('hint lists', () => {
  it('adds without duplicates and without changing the input', () => {
    const before = ['attach'] as const
    expect(withHint([...before], 'attach')).toEqual(['attach'])
    expect(withHint([...before], 'compare')).toEqual(['attach', 'compare'])
    expect(before).toEqual(['attach'])
  })

  it('merges two lists as a union', () => {
    expect(mergeHints(['attach'], ['attach', 'refine'])).toEqual(['attach', 'refine'])
  })
})

describe('HINT_IDS', () => {
  it('lists every hint the server knows, once', () => {
    expect([...HINT_IDS].sort()).toEqual(['attach', 'compare', 'refine', 'templates', 'think-harder', 'welcome', 'workspaces'])
  })
})
