// Words for the Learn page. Plain language, short sentences. Names what goes wrong, gives an action.

export interface Habit {
  id: string
  title: string
  body: string
  // Key in HABIT_EXAMPLES (chat/starter-tasks.ts). "Try it" opens home with that example.
  exampleId: string
}

export const HABITS: Habit[] = [
  { id: 'who', title: 'Say who it is for', body: 'Tell Genie who will read it, like “a resident who is new to the program.” The tone and the words change to fit.', exampleId: 'habit-who' },
  { id: 'background', title: 'Give background', body: 'Add what it needs to know: what happened, the facts, the rules. Genie only knows what you tell it or attach.', exampleId: 'habit-background' },
  { id: 'format', title: 'Ask for a format', body: 'Say how long it should be and what shape it takes: a short email, three bullets, a table.', exampleId: 'habit-format' },
  { id: 'refine', title: 'Then change it', body: 'Read the answer, then reply with what to change: “Shorter.” “Friendlier.” “Add the deadline.” You do not need to start over.', exampleId: 'habit-refine' },
]

export interface CheckItem {
  title: string
  body: string
}

export const CHECK_ITEMS: CheckItem[] = [
  { title: 'Names and titles', body: 'It may mix up people, offices or programs.' },
  { title: 'Numbers and amounts', body: 'Fees, counts and percentages can be off.' },
  { title: 'Dates and deadlines', body: 'It can get a date wrong or use an old one.' },
  { title: 'Laws and rules', body: 'It may cite a rule that does not say that, or does not exist.' },
  { title: 'Quotes and sources', body: 'A quote may be reworded. A source may be made up.' },
]

export const CHECK_STEPS: string[] = [
  'Find the original: the document, the official web page or the person who knows.',
  'Match each name, number, date and rule in the answer to the original.',
  'Not sure what to look at? Press “Check this answer” under any answer. Genie lists what to verify.',
]

export interface ToolNote {
  name: string
  body: string
}

// The buttons around the message box, in plain words. "Workspace" is the one people ask about.
export const TOOL_NOTES: ToolNote[] = [
  { name: 'Attach', body: 'Add a PDF, a Word file or a photo, and Genie reads it.' },
  { name: 'Workspace', body: 'A shared folder of your team’s documents that Genie can search and cite. Pick one, and answers point back to the files they came from.' },
  { name: 'Compare', body: 'Send one request to 2 or 3 models and read the answers side by side.' },
  { name: 'Think harder', body: 'Slower, but better on tricky questions. Only some models have it.' },
  { name: 'Help me ask', body: 'Rewrites a rough request so it is clearer, and shows you what it added.' },
]

// "Choosing a model": the default is for most work, the others are for harder jobs. The name comes from settings.
export function modelNote(defaultLabel: string | undefined): string {
  const lead = defaultLabel ? `${defaultLabel} is the everyday default.` : 'The default model is the everyday choice.'
  return `${lead} It is quick and good for most work. The other models are for harder jobs, and they cost more to run. Not sure? Stay with the default.`
}

export const HOW_IT_WORKS: string[] = [
  'Genie is an AI assistant. You tell it what you need in your own words, and it writes back.',
  'It is a conversation, not a search box. Reply to improve the answer, as many times as you like.',
  'It is good at drafting, summarizing and explaining. It does not know your agency’s rules unless you give them to it in a file or a workspace.',
]

import { isEmail, isHttpsUrl, mailtoHref } from './url-rules'

export interface HelpLink {
  href: string
  label: string
  isExternal: boolean
}

// helpContact is an email address or an https URL. Anything else (or empty) shows nothing.
export function helpLink(contact: string): HelpLink | null {
  const value = contact.trim()
  if (value === '') return null
  if (isHttpsUrl(value)) return { href: value, label: value.replace(/^https:\/\//i, ''), isExternal: true }
  if (isEmail(value)) return { href: mailtoHref(value), label: value, isExternal: false }
  return null
}
