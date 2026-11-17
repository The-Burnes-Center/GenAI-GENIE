import { describe, expect, it } from 'vitest'
import { checkMessageLimits, MAX_DOCUMENTS_PER_MESSAGE, MAX_IMAGES_PER_MESSAGE, MAX_PROMPT_CHARS } from './limits'

const files = (names: string[]) => names.map((name) => ({ name }))

describe('checkMessageLimits', () => {
  it('allows a prompt of exactly 400,000 characters and rejects one more', () => {
    expect(checkMessageLimits('x'.repeat(MAX_PROMPT_CHARS), [])).toBeNull()
    expect(checkMessageLimits('x'.repeat(MAX_PROMPT_CHARS + 1), [])).not.toBeNull()
  })

  it('allows five documents and rejects a sixth', () => {
    const five = files(['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf', 'e.pdf'])
    expect(checkMessageLimits('', five)).toBeNull()
    expect(checkMessageLimits('', [...five, { name: 'f.pdf' }])).toBe(
      `Attach up to ${MAX_DOCUMENTS_PER_MESSAGE} documents per message.`,
    )
  })

  it('counts spreadsheets as documents and images separately', () => {
    const twentyImages = Array.from({ length: MAX_IMAGES_PER_MESSAGE }, (_, index) => ({ name: `p${index}.png` }))
    expect(checkMessageLimits('', twentyImages)).toBeNull()
    expect(checkMessageLimits('', [...twentyImages, { name: 'p.png' }])).toBe(
      `Attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.`,
    )
  })
})
