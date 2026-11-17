import { describe, expect, it } from 'vitest'
import { attachmentWarnings, hasBlockingWarning, screenNewFiles } from './attach-rules'

const file = (name: string, size = 1000) => ({ name, size })
const TEXT_ONLY = { label: 'Mistral Large 3', capabilities: { vision: false, documents: false } }
const FULL = { label: 'Claude Sonnet 5.5', capabilities: { vision: true, documents: true } }

describe('screenNewFiles', () => {
  it('refuses unsupported types with plain copy', () => {
    const { accepted, problems } = screenNewFiles([], [file('a.zip')])
    expect(accepted).toEqual([])
    expect(problems[0]).toBe("Genie can't read .zip files. Use PDF, Word, Excel, CSV, HTML, text, Markdown, or an image.")
  })

  it('enforces byte limits: 3.75 MB images, 4.5 MB documents', () => {
    expect(screenNewFiles([], [file('a.png', 3_750_000)]).accepted).toHaveLength(1)
    expect(screenNewFiles([], [file('a.png', 3_750_001)]).problems).toHaveLength(1)
    expect(screenNewFiles([], [file('a.pdf', 4_500_000)]).accepted).toHaveLength(1)
    expect(screenNewFiles([], [file('a.pdf', 4_500_001)]).problems).toHaveLength(1)
  })

  it('allows 5 documents and 20 images per message', () => {
    const docs = Array.from({ length: 5 }, (_, i) => file(`d${i}.pdf`))
    expect(screenNewFiles(docs, [file('six.pdf')]).problems[0]).toContain('up to 5 documents')
    const images = Array.from({ length: 20 }, (_, i) => file(`i${i}.png`))
    expect(screenNewFiles(images, [file('x.png')]).problems[0]).toContain('up to 20 images')
    expect(screenNewFiles(docs, [file('x.png')]).accepted).toHaveLength(1)
  })
})

describe('attachmentWarnings', () => {
  it('blocks an image on a model without vision and offers the switch', () => {
    const [warning] = attachmentWarnings([file('map.png')], TEXT_ONLY)
    expect(warning.tone).toBe('bad')
    expect(warning.message).toBe("Mistral Large 3 can't see images. map.png won't be sent to it. Switch to a model that can, or remove the image.")
    expect(warning.fix?.kind).toBe('switch-model')
  })

  it('blocks spreadsheets without document support but only informs for PDFs', () => {
    expect(hasBlockingWarning(attachmentWarnings([file('b.xlsx')], TEXT_ONLY))).toBe(true)
    const info = attachmentWarnings([file('a.pdf')], TEXT_ONLY)
    expect(info).toHaveLength(1)
    expect(hasBlockingWarning(info)).toBe(false)
  })

  it('says nothing when the model reads everything', () => {
    expect(attachmentWarnings([file('a.png'), file('b.xlsx'), file('c.pdf')], FULL)).toEqual([])
  })
})
