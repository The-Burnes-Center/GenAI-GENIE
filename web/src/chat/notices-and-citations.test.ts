import { describe, expect, it } from 'vitest'
import { noticeText } from './notice-copy'
import { citeIndexFromHref, remarkCitations } from './remark-citations'

describe('noticeText', () => {
  it('uses the designed copy for trimmed history and text-only documents', () => {
    expect(noticeText({ code: 'HISTORY_TRIMMED', message: 'x' })).toBe('Earlier messages were shortened to fit this model’s limit. Genie kept the most recent ones.')
    expect(noticeText({ code: 'ATTACHMENT_AS_TEXT', message: 'x' })).toContain('reads documents as plain text')
  })

  it('keeps the server text when it names files, and has fallback copy for the rest', () => {
    for (const code of ['ATTACHMENT_TRUNCATED', 'ATTACHMENTS_LIMITED', 'ATTACHMENT_EXPIRED', 'SAVE_FAILED']) {
      expect(noticeText({ code, message: 'a.pdf: details' })).toBe('a.pdf: details')
      expect(noticeText({ code, message: '' }).length).toBeGreaterThan(10)
    }
  })
})

interface Node { type: string; value?: string; url?: string; children?: Node[] }

describe('remarkCitations', () => {
  it('turns [n] into cite links only for known sources', () => {
    const tree: Node = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Twelve weeks [1] or more [9].' }] }] }
    remarkCitations([1, 2])()(tree)
    const parts = tree.children?.[0].children ?? []
    expect(parts.map((part) => part.type)).toEqual(['text', 'link', 'text'])
    expect(citeIndexFromHref(parts[1].url)).toBe(1)
    expect(parts[2].value).toBe(' or more [9].')
  })

  it('leaves code alone', () => {
    const tree: Node = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'inlineCode', value: 'a[1]' }] }] }
    remarkCitations([1])()(tree)
    expect(tree.children?.[0].children?.[0].type).toBe('inlineCode')
  })
})
