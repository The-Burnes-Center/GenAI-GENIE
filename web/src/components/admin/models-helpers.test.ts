import { describe, expect, it } from 'vitest'
import type { ModelConfig } from '../../api/types'
import { applyDraft, capabilityLabels, draftFromModel, validateDraft } from './models-helpers'

const MODEL: ModelConfig = {
  modelId: 'm1', label: 'Model one', provider: 'Acme', description: '', enabled: true,
  capabilities: { vision: true, documents: true, reasoning: false, temperature: false, promptCache: false },
  contextWindow: 200_000, maxOutputTokens: 8000, sortOrder: 2,
}

describe('model draft validation', () => {
  it('accepts a model as it is', () => {
    expect(validateDraft(draftFromModel(MODEL))).toEqual({})
  })
  it('flags empty names and non-numbers', () => {
    const errors = validateDraft({ ...draftFromModel(MODEL), label: ' ', contextWindow: 'abc', sortOrder: '-1' })
    expect(Object.keys(errors).sort()).toEqual(['contextWindow', 'label', 'sortOrder'])
  })
  it('rejects output larger than the context window', () => {
    expect(validateDraft({ ...draftFromModel(MODEL), maxOutputTokens: '300000' }).maxOutputTokens).toBeTruthy()
  })
  it('applies the draft with numbers and a trimmed label', () => {
    const next = applyDraft(MODEL, { ...draftFromModel(MODEL), label: ' New ', contextWindow: '1000', maxOutputTokens: '500' })
    expect(next).toMatchObject({ label: 'New', contextWindow: 1000, maxOutputTokens: 500, modelId: 'm1' })
  })
  it('describes capabilities in plain words', () => {
    expect(capabilityLabels(MODEL.capabilities)).toEqual(['Images', 'Documents'])
    expect(capabilityLabels({ ...MODEL.capabilities, vision: false, documents: false, reasoning: true })).toEqual(['Documents as text', 'Thinking'])
  })
})
