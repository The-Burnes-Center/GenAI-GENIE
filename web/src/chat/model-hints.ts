import type { Capabilities, ModelConfig } from '../api/types'

// Plain lines for the model picker. No model ids, no "tokens", no jargon.
export function readsLine(capabilities: Pick<Capabilities, 'vision' | 'documents'>): string {
  if (capabilities.vision && capabilities.documents) return 'Reads images and documents'
  if (capabilities.vision) return 'Reads images, documents as plain text'
  if (capabilities.documents) return 'Reads documents, no images'
  return 'Reads documents as plain text, no images'
}

export const THINK_HINT = 'Can think harder'

export interface ProviderGroup {
  provider: string
  models: ModelConfig[]
}

// Groups in the order providers first appear, so the admin's sort order decides who comes first.
export function groupByProvider(models: ModelConfig[]): ProviderGroup[] {
  const groups: ProviderGroup[] = []
  for (const model of models) {
    const group = groups.find((candidate) => candidate.provider === model.provider)
    if (group) group.models.push(model)
    else groups.push({ provider: model.provider, models: [model] })
  }
  return groups
}
