import { beforeEach, describe, expect, it } from 'vitest'
import { canShowTip, claimTip, resetTipSession } from './tip-session'

describe('tip pacing', () => {
  beforeEach(resetTipSession)

  it('lets the first tip show, and keeps showing that one', () => {
    expect(canShowTip('attach')).toBe(true)
    claimTip('attach')
    expect(canShowTip('attach')).toBe(true)
  })

  it('holds back every other tip for the rest of the session', () => {
    claimTip('attach')
    for (const hint of ['templates', 'workspaces', 'compare', 'think-harder'] as const) expect(canShowTip(hint)).toBe(false)
  })

  it('counts the welcome card as the session\'s guidance', () => {
    claimTip('welcome')
    expect(canShowTip('attach')).toBe(false)
  })

  it('does not let a later claim replace the first', () => {
    claimTip('compare')
    claimTip('attach')
    expect(canShowTip('compare')).toBe(true)
    expect(canShowTip('attach')).toBe(false)
  })
})
