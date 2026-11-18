import { describe, expect, it } from 'vitest'
import { countPlaceholders, nextPlaceholder, splitPlaceholders } from './placeholders'

describe('placeholders', () => {
  it('splits text into plain parts and [bracketed] blanks', () => {
    expect(splitPlaceholders('Write to [who] about [topic].')).toEqual([
      { text: 'Write to ', isPlaceholder: false },
      { text: '[who]', isPlaceholder: true },
      { text: ' about ', isPlaceholder: false },
      { text: '[topic]', isPlaceholder: true },
      { text: '.', isPlaceholder: false },
    ])
  })

  it('leaves text without blanks alone, and ignores brackets that span lines', () => {
    expect(splitPlaceholders('No blanks here')).toEqual([{ text: 'No blanks here', isPlaceholder: false }])
    expect(countPlaceholders('[a\nb]')).toBe(0)
    expect(countPlaceholders('[a] and [b]')).toBe(2)
  })

  it('finds the next blank and wraps around', () => {
    const text = 'Hi [one] and [two]'
    expect(nextPlaceholder(text, 0)).toEqual({ start: 3, end: 8 })
    expect(nextPlaceholder(text, 8)).toEqual({ start: 13, end: 18 })
    expect(nextPlaceholder(text, 18)).toEqual({ start: 3, end: 8 })
    expect(nextPlaceholder('none', 0)).toBeNull()
  })
})
