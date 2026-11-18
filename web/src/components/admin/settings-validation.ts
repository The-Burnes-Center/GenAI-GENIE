import type { LearnLink, Settings } from '../../api/types'
import { isEmail, isHttpsUrl } from '../../chat/url-rules'

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
  'assistantInstructions',
  'dataRules',
  'learnLinks',
  'helpContact',
  'allowedEmailDomains',
] as const

export const HELP_LIMITS = {
  instructions: 4000,
  rules: 10,
  rule: 200,
  links: 8,
  linkTitle: 80,
  linkUrl: 500,
  linkDescription: 200,
  contact: 200,
} as const

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

export function checkHelpContact(value: string): string | undefined {
  const text = value.trim()
  if (text === '') return undefined
  if (text.length > HELP_LIMITS.contact) return `Keep it under ${HELP_LIMITS.contact} characters.`
  return isEmail(text) || isHttpsUrl(text) ? undefined : 'Enter an email address or a link that starts with https://'
}

// One message per bad rule (dataRules.0, dataRules.1, ...), and one for too many.
function checkRules(rules: string[]): SettingsErrors {
  const errors: SettingsErrors = {}
  if (rules.length > HELP_LIMITS.rules) errors.dataRules = `Keep it to ${HELP_LIMITS.rules} rules or fewer.`
  rules.forEach((rule, index) => {
    if (rule.trim() === '') errors[`dataRules.${index}`] = 'Write the rule, or remove this row.'
    else if (rule.trim().length > HELP_LIMITS.rule) errors[`dataRules.${index}`] = `Keep it under ${HELP_LIMITS.rule} characters.`
  })
  return errors
}

function checkLink(link: LearnLink, index: number): SettingsErrors {
  const key = `learnLinks.${index}`
  const url = link.url.trim()
  const title = link.title.trim()
  return {
    [`${key}.title`]: title === '' ? 'Enter a title.' : title.length > HELP_LIMITS.linkTitle ? `Keep it under ${HELP_LIMITS.linkTitle} characters.` : undefined,
    [`${key}.url`]: !isHttpsUrl(url) ? 'Enter a full link that starts with https://' : url.length > HELP_LIMITS.linkUrl ? `Keep it under ${HELP_LIMITS.linkUrl} characters.` : undefined,
    [`${key}.description`]: (link.description ?? '').trim().length > HELP_LIMITS.linkDescription ? `Keep it under ${HELP_LIMITS.linkDescription} characters.` : undefined,
  }
}

function checkLinks(links: LearnLink[]): SettingsErrors {
  const own: SettingsErrors = links.length > HELP_LIMITS.links ? { learnLinks: `Keep it to ${HELP_LIMITS.links} links or fewer.` } : {}
  return Object.assign(own, ...links.map(checkLink))
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
    assistantInstructions:
      draft.assistantInstructions.trim().length > HELP_LIMITS.instructions ? `Keep it under ${HELP_LIMITS.instructions} characters.` : undefined,
    helpContact: checkHelpContact(draft.helpContact),
    ...checkRules(draft.dataRules),
    ...checkLinks(draft.learnLinks),
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined))
}

// The first error in page order. List rows report as "dataRules.2", so match a field or its rows.
export function firstInvalidField(errors: SettingsErrors): string | undefined {
  for (const field of SETTINGS_FIELD_ORDER) {
    const key = Object.keys(errors).find((candidate) => candidate === field || candidate.startsWith(`${field}.`))
    if (key) return key
  }
  return undefined
}
