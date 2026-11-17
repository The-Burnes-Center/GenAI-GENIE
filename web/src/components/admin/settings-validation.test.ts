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
