import type { Template } from '../api/types'

export type StarterIcon = 'summarize' | 'plain' | 'reply' | 'agenda' | 'policy' | 'translate' | 'actions' | 'faq'

export interface StarterTask {
  id: string
  title: string
  // One line under the title.
  line: string
  icon: StarterIcon
  // Fills the composer. The [bracketed] parts are for the person to replace.
  prompt: string
  // An enabled template with a matching title wins over the built-in prompt, so admins can tune the wording.
  templateMatch?: RegExp
}

// The first six show on the home screen. All eight show on the Learn page under "Try these".
export const STARTER_TASKS: StarterTask[] = [
  {
    id: 'summarize',
    title: 'Summarize a document',
    line: 'Get the key points and deadlines from a long file.',
    icon: 'summarize',
    prompt: 'Summarize the attached document in plain language for [who will read it]. List the key points, and any dates or deadlines.',
    templateMatch: /summar/i,
  },
  {
    id: 'plain-language',
    title: 'Rewrite in plain language',
    line: 'Make formal or technical text easy to read.',
    icon: 'plain',
    prompt: 'Rewrite the text below in plain language at about an 8th-grade reading level. Keep every fact and number.\n\n[paste your text here]',
    templateMatch: /plain/i,
  },
  {
    id: 'reply-resident',
    title: 'Draft a reply to a resident',
    line: 'A polite, clear answer you can edit and send.',
    icon: 'reply',
    prompt:
      'Draft a reply to a resident who wrote to us about [their question or complaint]. Be polite and clear. Explain [what we can do], and say what happens next. Keep it under 150 words.\n\nTheir message:\n[paste their message here]',
  },
  {
    id: 'meeting-agenda',
    title: 'Plan a meeting',
    line: 'An agenda with times and a goal for each item.',
    icon: 'agenda',
    prompt: 'Create a [30 or 60] minute agenda for a meeting about [topic]. Attendees: [roles]. Give each item a time and a goal.',
    templateMatch: /agenda/i,
  },
  {
    id: 'explain-policy',
    title: 'Explain a policy',
    line: 'What changed, who it affects, and what to do.',
    icon: 'policy',
    prompt: 'Explain this policy to [staff or residents] in everyday words. Say what changed, who is affected, and what they need to do.\n\n[paste the policy here]',
    templateMatch: /polic/i,
  },
  {
    id: 'translate',
    title: 'Translate a message',
    line: 'Translate it and keep the tone.',
    icon: 'translate',
    prompt: 'Translate the message below into [language]. Keep the tone [friendly and formal].\n\n[paste your message here]',
    templateMatch: /translat/i,
  },
  {
    id: 'action-items',
    title: 'List action items',
    line: 'Pull out who does what, and by when.',
    icon: 'actions',
    prompt: 'List the action items from these meeting notes. For each one, give the owner and the due date if it is mentioned. If something is missing, say so.\n\n[paste your notes here]',
    templateMatch: /action/i,
  },
  {
    id: 'faq',
    title: 'Write an FAQ',
    line: 'Likely questions and short answers, ready to post.',
    icon: 'faq',
    prompt: 'Write 6 frequently asked questions with short answers about [topic], for [residents or staff]. Use only the facts in the attached document.',
    templateMatch: /faq/i,
  },
]

export const HOME_STARTER_COUNT = 6

// The four habits on the Learn page. Each "Try it" opens home with a filled example.
export const HABIT_EXAMPLES: Record<string, string> = {
  'habit-who':
    'Write a short note about [topic]. It is for [who will read it, for example a resident who is new to the program], so keep the tone [friendly and formal].',
  'habit-background':
    'Draft a reply to a resident who asked about [their question]. Background: [what has happened so far, and any rules that apply]. Use only these facts.',
  'habit-format': 'Explain [topic] in 3 bullet points. Keep each one under 20 words.',
  'habit-refine': 'Write a two-sentence announcement that [event] is moving to [new date]. After you answer, I will ask you to change the tone.',
}

export interface ResolvedStarter {
  prompt: string
  // Set when an admin template stands in for the built-in prompt.
  template?: Template
}

// "Using templates where one exists": a matching enabled template supplies the prompt and its hidden instructions.
export function resolveStarter(task: StarterTask, templates: Template[]): ResolvedStarter {
  const template = task.templateMatch
    ? templates.find((candidate) => candidate.enabled && candidate.starterPrompt.trim() !== '' && task.templateMatch?.test(candidate.title))
    : undefined
  return template ? { prompt: template.starterPrompt, template } : { prompt: task.prompt }
}

// What `/home?starter=<id>` should fill in. Learn page "Try it" links use this.
export function resolveStarterParam(id: string | null | undefined, templates: Template[]): ResolvedStarter | undefined {
  if (!id) return undefined
  const task = STARTER_TASKS.find((candidate) => candidate.id === id)
  if (task) return resolveStarter(task, templates)
  const prompt = HABIT_EXAMPLES[id]
  return prompt ? { prompt } : undefined
}
