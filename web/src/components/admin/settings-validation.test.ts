import { describe, expect, it } from 'vitest'
import { initialSettings } from '../../mock/seed-catalog'
import { firstInvalidField, parseDomains, validateSettings } from './settings-validation'

const MODELS = [initialSettings().defaultModelId, initialSettings().titleModelId]

describe('validateSettings', () => {
  it('accepts the seed settings', () => {
    expect(validateSettings(initialSettings(), MODELS)).toEqual({})
  })

  it('flags out of range numbers and bad zones', () => {
    const errors = validateSettings(
      { ...initialSettings(), maxCompareModels: 1, retrievalTopK: 21, dailyMessageLimit: -1, timezone: 'Mars/Base' },
      MODELS,
    )
    expect(Object.keys(errors).sort()).toEqual(['dailyMessageLimit', 'maxCompareModels', 'retrievalTopK', 'timezone'])
  })

  it('treats NaN as invalid and reports the first field in page order', () => {
    const errors = validateSettings({ ...initialSettings(), retrievalTopK: Number.NaN, appName: ' ' }, MODELS)
    expect(firstInvalidField(errors)).toBe('appName')
  })

  it('rejects duplicate or empty category lists and bad domains', () => {
    const errors = validateSettings({ ...initialSettings(), templateCategories: ['A', 'a'], allowedEmailDomains: ['nodot'] }, MODELS)
    expect(errors.templateCategories).toMatch(/only once/)
    expect(errors.allowedEmailDomains).toBeDefined()
    expect(validateSettings({ ...initialSettings(), templateCategories: [] }, MODELS).templateCategories).toMatch(/at least one/)
  })

  it('parses domains to lowercase without @', () => {
    expect(parseDomains('@Example.ORG, example.gov  ')).toEqual(['example.org', 'example.gov'])
  })
})

describe('help and learning fields', () => {
  const base = initialSettings()

  it('accepts the seed values and empty lists', () => {
    expect(validateSettings({ ...base, dataRules: [], learnLinks: [], helpContact: '' }, MODELS)).toEqual({})
  })

  it('enforces the limits on instructions, rules and contact', () => {
    const errors = validateSettings(
      { ...base, assistantInstructions: 'x'.repeat(4001), dataRules: Array.from({ length: 11 }, () => 'ok'), helpContact: 'call me' },
      MODELS,
    )
    expect(Object.keys(errors).sort()).toEqual(['assistantInstructions', 'dataRules', 'helpContact'])
    expect(validateSettings({ ...base, dataRules: ['x'.repeat(201), ' '] }, MODELS)).toMatchObject({
      'dataRules.0': expect.stringMatching(/under 200/),
      'dataRules.1': expect.stringMatching(/Write the rule/),
    })
  })

  it('accepts an email or https contact, and rejects http', () => {
    expect(validateSettings({ ...base, helpContact: 'a@b.org' }, MODELS)).toEqual({})
    expect(validateSettings({ ...base, helpContact: 'https://help.example.org' }, MODELS)).toEqual({})
    expect(validateSettings({ ...base, helpContact: 'http://help.example.org' }, MODELS).helpContact).toBeDefined()
    expect(validateSettings({ ...base, helpContact: 'a@b.c' }, MODELS).helpContact).toBeDefined()
    expect(validateSettings({ ...base, helpContact: 'a@b.co' }, MODELS)).toEqual({})
  })

  it('checks each link and limits the count', () => {
    const errors = validateSettings(
      { ...base, learnLinks: [{ title: '', url: 'http://x.org' }, { title: 'ok', url: 'https://x.org', description: 'd'.repeat(201) }] },
      MODELS,
    )
    expect(Object.keys(errors).sort()).toEqual(['learnLinks.0.title', 'learnLinks.0.url', 'learnLinks.1.description'])
    const tooMany = Array.from({ length: 9 }, (_, i) => ({ title: `t${i}`, url: 'https://x.org' }))
    expect(validateSettings({ ...base, learnLinks: tooMany }, MODELS).learnLinks).toMatch(/8 links/)
  })

  it('reports the first row error in page order', () => {
    const errors = validateSettings({ ...base, dataRules: ['', 'ok'], helpContact: 'nope' }, MODELS)
    expect(firstInvalidField(errors)).toBe('dataRules.0')
  })
})
