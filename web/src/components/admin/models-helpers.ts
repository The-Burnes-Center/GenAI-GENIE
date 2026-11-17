import type { AvailableModel, Capabilities, ModelConfig } from '../../api/types'

export const DEFAULT_CONTEXT_WINDOW = 128_000
export const DEFAULT_MAX_OUTPUT = 4096
export const DEFAULT_MODEL_OFF_MESSAGE = "The default model can't be turned off. Choose another default first."

const NO_CAPABILITIES: Capabilities = { vision: false, documents: false, reasoning: false, temperature: false, promptCache: false }

// Plain-words list of what a model can do, for the "Can do" column.
export function capabilityLabels(capabilities: Capabilities): string[] {
  const labels: string[] = []
  if (capabilities.vision) labels.push('Images')
  labels.push(capabilities.documents ? 'Documents' : 'Documents as text')
  if (capabilities.reasoning) labels.push('Thinking')
  return labels
}

export function newModelFrom(available: AvailableModel, label: string, sortOrder: number): ModelConfig {
  return {
    modelId: available.modelId,
    label,
    provider: available.provider,
    description: 'Added by an administrator.',
    enabled: false,
    capabilities: NO_CAPABILITIES,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxOutputTokens: DEFAULT_MAX_OUTPUT,
    sortOrder,
  }
}

export interface ModelDraft {
  label: string
  description: string
  capabilities: Capabilities
  contextWindow: string
  maxOutputTokens: string
  sortOrder: string
}

export type ModelDraftField = 'label' | 'contextWindow' | 'maxOutputTokens' | 'sortOrder'
export type ModelDraftErrors = Partial<Record<ModelDraftField, string>>

export function draftFromModel(model: ModelConfig): ModelDraft {
  return {
    label: model.label,
    description: model.description,
    capabilities: model.capabilities,
    contextWindow: String(model.contextWindow),
    maxOutputTokens: String(model.maxOutputTokens),
    sortOrder: String(model.sortOrder),
  }
}

const WHOLE_NUMBER = /^\d+$/

export function validateDraft(draft: ModelDraft): ModelDraftErrors {
  const errors: ModelDraftErrors = {}
  if (draft.label.trim() === '') errors.label = 'Enter the name people will see.'
  if (!WHOLE_NUMBER.test(draft.contextWindow) || Number(draft.contextWindow) < 1) errors.contextWindow = 'Enter a whole number above 0.'
  if (!WHOLE_NUMBER.test(draft.maxOutputTokens) || Number(draft.maxOutputTokens) < 1) errors.maxOutputTokens = 'Enter a whole number above 0.'
  else if (!errors.contextWindow && Number(draft.maxOutputTokens) > Number(draft.contextWindow)) {
    errors.maxOutputTokens = "Can't be larger than the context window."
  }
  if (!WHOLE_NUMBER.test(draft.sortOrder)) errors.sortOrder = 'Enter a whole number of 0 or more.'
  return errors
}

export function applyDraft(model: ModelConfig, draft: ModelDraft): ModelConfig {
  return {
    ...model,
    label: draft.label.trim(),
    description: draft.description.trim(),
    capabilities: draft.capabilities,
    contextWindow: Number(draft.contextWindow),
    maxOutputTokens: Number(draft.maxOutputTokens),
    sortOrder: Number(draft.sortOrder),
  }
}
