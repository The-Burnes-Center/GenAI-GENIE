import { describe, expect, it } from 'vitest'
import { classifyFile, validateUpload, IMAGE_LIMIT_BYTES, ATTACHMENT_DOCUMENT_LIMIT_BYTES, WORKSPACE_DOCUMENT_LIMIT_BYTES } from './validation'

const ALL = { vision: true, documents: true, reasoning: false, temperature: false, promptCache: false }
const TEXT_ONLY = { ...ALL, vision: false, documents: false }

describe('validateUpload size limits', () => {
  it('accepts an image exactly at the 3.75 MB limit and rejects one byte over', () => {
    expect(validateUpload({ name: 'a.png', size: IMAGE_LIMIT_BYTES }, 'attachment', ALL).ok).toBe(true)
    expect(validateUpload({ name: 'a.png', size: IMAGE_LIMIT_BYTES + 1 }, 'attachment', ALL).ok).toBe(false)
  })

  it('applies the 4.5 MB limit to chat document attachments', () => {
    expect(validateUpload({ name: 'a.pdf', size: ATTACHMENT_DOCUMENT_LIMIT_BYTES }, 'attachment', ALL).ok).toBe(true)
    expect(validateUpload({ name: 'a.pdf', size: ATTACHMENT_DOCUMENT_LIMIT_BYTES + 1 }, 'attachment', ALL).ok).toBe(false)
  })

  it('allows 50 MB for workspace documents but not 50 MB plus one byte', () => {
    expect(validateUpload({ name: 'a.pdf', size: WORKSPACE_DOCUMENT_LIMIT_BYTES }, 'workspace').ok).toBe(true)
    expect(validateUpload({ name: 'a.pdf', size: WORKSPACE_DOCUMENT_LIMIT_BYTES + 1 }, 'workspace').ok).toBe(false)
  })

  it('rejects empty files', () => {
    expect(validateUpload({ name: 'a.txt', size: 0 }, 'attachment', ALL)).toEqual({
      ok: false,
      message: 'a.txt is empty.',
    })
  })
})

describe('validateUpload types and capabilities', () => {
  it('rejects unknown extensions and files with no extension', () => {
    expect(validateUpload({ name: 'run.exe', size: 10 }, 'attachment', ALL).ok).toBe(false)
    expect(validateUpload({ name: 'README', size: 10 }, 'attachment', ALL).ok).toBe(false)
  })

  it('returns the canonical content type for the extension', () => {
    expect(validateUpload({ name: 'Photo.JPG', size: 10 }, 'attachment', ALL)).toEqual({
      ok: true,
      contentType: 'image/jpeg',
    })
  })

  it('blocks images for models without vision, with an explanation', () => {
    const result = validateUpload({ name: 'a.webp', size: 10 }, 'attachment', TEXT_ONLY)
    expect(result).toEqual({ ok: false, message: 'The selected model cannot read images.' })
  })

  it('blocks spreadsheets for models without document support', () => {
    const result = validateUpload({ name: 'sales.xlsx', size: 10 }, 'attachment', TEXT_ONLY)
    expect(result).toEqual({ ok: false, message: 'The selected model cannot read spreadsheets.' })
  })

  it('allows plain documents for every model because the server extracts their text', () => {
    expect(validateUpload({ name: 'notes.pdf', size: 10 }, 'attachment', TEXT_ONLY).ok).toBe(true)
    expect(validateUpload({ name: 'notes.docx', size: 10 }, 'attachment', TEXT_ONLY).ok).toBe(true)
  })

  it('rejects images in workspaces and accepts spreadsheets there', () => {
    expect(validateUpload({ name: 'a.png', size: 10 }, 'workspace').ok).toBe(false)
    expect(validateUpload({ name: 'data.csv', size: 10 }, 'workspace').ok).toBe(true)
  })
})

describe('classifyFile', () => {
  it('classifies by extension', () => {
    expect(classifyFile('a.gif')).toBe('image')
    expect(classifyFile('a.csv')).toBe('spreadsheet')
    expect(classifyFile('a.md')).toBe('document')
    expect(classifyFile('a.zip')).toBeNull()
  })
})
