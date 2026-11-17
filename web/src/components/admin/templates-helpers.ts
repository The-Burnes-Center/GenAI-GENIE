import type { Template } from '../../api/types'

export interface TemplateDraft {
  title: string
  description: string
  category: string
  systemPrompt: string
  starterPrompt: string
  enabled: boolean
  sortOrder: string
}

export type TemplateDraftErrors = Partial<Record<'title' | 'category' | 'sortOrder', string>>

export function newTemplateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function emptyDraft(category: string, sortOrder: number): TemplateDraft {
  return { title: '', description: '', category, systemPrompt: '', starterPrompt: '', enabled: true, sortOrder: String(sortOrder) }
}

export function draftFromTemplate(template: Template): TemplateDraft {
  return {
    title: template.title,
    description: template.description,
    category: template.category,
    systemPrompt: template.systemPrompt,
    starterPrompt: template.starterPrompt,
    enabled: template.enabled,
    sortOrder: String(template.sortOrder),
  }
}

export function validateTemplate(draft: TemplateDraft): TemplateDraftErrors {
  const errors: TemplateDraftErrors = {}
  if (draft.title.trim() === '') errors.title = 'Give the template a title.'
  if (draft.category.trim() === '') errors.category = 'Choose a category.'
  if (!/^\d+$/.test(draft.sortOrder)) errors.sortOrder = 'Enter a whole number of 0 or more.'
  return errors
}

export function templateFromDraft(templateId: string, draft: TemplateDraft): Template {
  return {
    templateId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    category: draft.category,
    systemPrompt: draft.systemPrompt,
    starterPrompt: draft.starterPrompt,
    enabled: draft.enabled,
    sortOrder: Number(draft.sortOrder),
  }
}

// The category list comes from settings. A template whose category was removed there keeps it as a choice.
export function categoryOptions(categories: string[], current: string): Array<{ id: string; label: string }> {
  const all = current !== '' && !categories.includes(current) ? [...categories, current] : categories
  return all.map((name) => ({ id: name, label: name }))
}
