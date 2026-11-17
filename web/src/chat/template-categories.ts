import type { Template } from '../api/types'

export const ALL_CATEGORIES = 'All'

// "All" first, then the admin's category order, keeping only categories that have a template to show.
// Templates in a category the list does not name still appear under All.
export function visibleCategories(categories: string[], templates: Template[]): string[] {
  return [ALL_CATEGORIES, ...categories.filter((category) => templates.some((template) => template.category === category))]
}

export function templatesInCategory(templates: Template[], category: string): Template[] {
  return [...templates]
    .filter((template) => category === ALL_CATEGORIES || template.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
