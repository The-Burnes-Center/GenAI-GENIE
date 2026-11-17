import type { Settings } from '../../api/types'

export type SettingsErrors = Partial<Record<string, string>>

// Order the fields appear on the page, so the first error in this order gets focus.
export const SETTINGS_FIELD_ORDER = [
  'appName',
  'welcomeTitle',
  'defaultModelId',
  'titleModelId',
  'dailyMessageLimit',
  'maxCompareModels',
  'retrievalTopK',
  'timezone',
  'templateCategories',
  'allowedEmailDomains',
] as const

const COMPARE_MIN = 2
const COMPARE_MAX = 4
const TOP_K_MIN = 1
const TOP_K_MAX = 20
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/

export function parseDomains(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((domain) => domain.trim().replace(/^@/, '').toLowerCase())
    .filter((domain) => domain !== '')
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone.trim() !== ''
  } catch {
    return false
  }
}

function checkWhole(value: number, min: number, max: number | undefined, message: string): string | undefined {
  const isWhole = Number.isInteger(value) && value >= min && (max === undefined || value <= max)
  return isWhole ? undefined : message
}

function checkCategories(categories: string[]): string | undefined {
  if (categories.length === 0) return 'Keep at least one category.'
  const lower = categories.map((name) => name.trim().toLowerCase())
  if (lower.some((name) => name === '')) return 'Categories cannot be empty.'
  if (new Set(lower).size !== lower.length) return 'Each category can appear only once.'
  return undefined
}

// Returns a message per invalid field. An empty object means the settings can be saved.
export function validateSettings(draft: Settings, modelIds: string[]): SettingsErrors {
  const errors: SettingsErrors = {
    appName: draft.appName.trim() === '' ? 'Enter a name for the app.' : undefined,
    welcomeTitle: draft.welcomeTitle.trim() === '' ? 'Enter a welcome title.' : undefined,
    defaultModelId: modelIds.includes(draft.defaultModelId) ? undefined : 'Choose a default model.',
    titleModelId: modelIds.includes(draft.titleModelId) ? undefined : 'Choose a model for chat titles.',
    dailyMessageLimit: checkWhole(draft.dailyMessageLimit, 0, undefined, 'Enter a whole number, 0 or more.'),
    maxCompareModels: checkWhole(draft.maxCompareModels, COMPARE_MIN, COMPARE_MAX, `Enter a whole number from ${COMPARE_MIN} to ${COMPARE_MAX}.`),
    retrievalTopK: checkWhole(draft.retrievalTopK, TOP_K_MIN, TOP_K_MAX, `Enter a whole number from ${TOP_K_MIN} to ${TOP_K_MAX}.`),
    timezone: isValidTimeZone(draft.timezone) ? undefined : 'Choose a time zone from the list.',
    templateCategories: checkCategories(draft.templateCategories),
    allowedEmailDomains: draft.allowedEmailDomains.every((domain) => DOMAIN_PATTERN.test(domain))
      ? undefined
      : 'Use domains like example.org, separated by commas.',
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined))
}

export function firstInvalidField(errors: SettingsErrors): string | undefined {
  return SETTINGS_FIELD_ORDER.find((field) => errors[field] !== undefined)
}
