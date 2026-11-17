import { describe, expect, it } from 'vitest'
import { daysInclusive, lastDays, MAX_RANGE_DAYS, presetRange, validateRange } from './usage-range'

const TODAY = '2026-11-17'

describe('usage range', () => {
  it('accepts exactly 92 days and rejects 93', () => {
    const ok = lastDays(MAX_RANGE_DAYS, TODAY)
    expect(daysInclusive(ok.from, ok.to)).toBe(92)
    expect(validateRange(ok, TODAY)).toBeNull()
    const tooLong = lastDays(MAX_RANGE_DAYS + 1, TODAY)
    expect(validateRange(tooLong, TODAY)).toBe('Choose a range of 92 days or fewer.')
  })

  it('rejects a start after the end, a future end and blanks', () => {
    expect(validateRange({ from: '2026-11-10', to: '2026-11-01' }, TODAY)).toMatch(/on or before/)
    expect(validateRange({ from: '2026-11-10', to: '2026-11-18' }, TODAY)).toMatch(/future/)
    expect(validateRange({ from: '', to: TODAY }, TODAY)).toMatch(/both/)
  })

  it('builds presets that are valid', () => {
    expect(presetRange('last7', TODAY)).toEqual({ from: '2026-11-11', to: TODAY })
    expect(presetRange('month', TODAY)).toEqual({ from: '2026-11-01', to: TODAY })
    expect(validateRange(presetRange('last30', TODAY), TODAY)).toBeNull()
  })
})
