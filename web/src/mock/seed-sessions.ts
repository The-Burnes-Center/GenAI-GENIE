// Chat history for mock mode: the prototype's nine sessions plus generated ones, so the sidebar
// needs infinite scroll (more than 50 sessions) and title search has something to find.
import type { Citation, Message, Session } from '../api/types'
import { CANNED, MD_FORMULA, MD_LEAVE, MD_SNOW, THINK_SNOW } from './seed-text'
import { GPT_ID, HAIKU_ID, MISTRAL_ID, NOVA_PRO_ID, OPUS_ID, QWEN_ID, SONNET_ID } from './seed-catalog'

export interface MockSession extends Session {
  messages: Message[]
}

const HOUR_MS = 3_600_000

export const CITATIONS: Citation[] = [
  { index: 1, title: 'Parental-Leave-Policy-2026.pdf', snippet: 'Eligible employees receive twelve (12) weeks of paid parental leave following the birth, adoption, or foster placement of a child.', workspaceId: 'w1', documentId: 'd1' },
  { index: 2, title: 'Parental-Leave-Policy-2026.pdf', snippet: 'Leave may be taken in one continuous period or in shorter periods, provided all leave is used within twelve months of the child’s arrival.', workspaceId: 'w1', documentId: 'd1' },
  { index: 3, title: 'Leave-Request-Procedures.docx', snippet: 'Employees should give at least thirty (30) days’ notice of planned leave whenever possible.', workspaceId: 'w1', documentId: 'd2' },
]

const TOPICS = [
  'Budget hearing questions', 'Rewrite: water shutoff notice', 'Records retention schedule', 'Parking permit appeal letter',
  'Summary of the zoning change', 'Translate library hours into Spanish', 'Grant reporting checklist', 'Holiday schedule FAQ',
  'Procurement threshold explained', 'Agenda for the community meeting', 'Public comment summary', 'Vendor contract renewal notes',
  'Plain-language sick leave policy', 'Snow day communications', 'Permit fee comparison', 'Board minutes action items',
  'Draft press release on the new park', 'Accessibility review for the website', 'Staff training outline', 'Emergency alert wording',
]

function message(sessionId: string, index: number, fields: Omit<Message, 'messageId' | 'sessionId' | 'createdAt'>, at: number): Message {
  return {
    messageId: `${sessionId}-m${index}`,
    sessionId,
    attachments: [],
    citations: [],
    createdAt: new Date(at).toISOString(),
    ...fields,
  }
}

function session(sessionId: string, title: string, modelId: string, updatedAt: number, messages: Message[], extra: Partial<Session> = {}): MockSession {
  const createdAt = messages[0] ? messages[0].createdAt : new Date(updatedAt).toISOString()
  return {
    sessionId,
    title,
    mode: 'chat',
    modelId,
    createdAt,
    updatedAt: new Date(updatedAt).toISOString(),
    messageCount: messages.length,
    messages,
    ...extra,
  }
}

function prototypeSessions(now: number): MockSession[] {
  const t = (hoursAgo: number) => now - hoursAgo * HOUR_MS
  return [
    session('c1', 'Snow emergency plan summary', SONNET_ID, t(1), [
      message('c1', 0, { role: 'user', content: 'Summarize the key changes in this plan for front-desk staff, in plain language. What do residents need to do?', attachments: [
        { key: 'attachments/mock/c1/Snow-Emergency-Plan-2026.pdf', name: 'Snow-Emergency-Plan-2026.pdf', contentType: 'application/pdf', size: 1_800_000 },
        { key: 'attachments/mock/c1/parking-map.png', name: 'parking-map.png', contentType: 'image/png', size: 640_000 },
      ] }, t(1)),
      message('c1', 1, { role: 'assistant', content: MD_SNOW, modelId: SONNET_ID, reasoning: THINK_SNOW, thinkingMs: 9000, latencyMs: 11400, stopReason: 'end_turn' }, t(1)),
      message('c1', 2, { role: 'user', content: 'Can you give me a spreadsheet formula that counts open snow-route complaints older than 3 days?' }, t(1)),
      message('c1', 3, { role: 'assistant', content: MD_FORMULA, modelId: SONNET_ID, latencyMs: 3100, stopReason: 'end_turn' }, t(1)),
    ]),
    session('c2', 'Parental leave questions', SONNET_ID, t(3), [
      message('c2', 0, { role: 'user', content: 'How many weeks of paid parental leave do new parents get, and can it be split up?' }, t(3)),
      message('c2', 1, { role: 'assistant', content: MD_LEAVE, modelId: SONNET_ID, citations: CITATIONS, latencyMs: 4200, stopReason: 'end_turn' }, t(3)),
    ], { workspaceId: 'w1' }),
    session('c3', 'Draft email to vendor about late delivery', OPUS_ID, t(4), [
      message('c3', 0, { role: 'user', content: 'Draft an email to the vendor about the late delivery of the office chairs.' }, t(4)),
      message('c3', 1, { role: 'assistant', content: '', modelId: OPUS_ID, error: { code: 'BEDROCK_THROTTLED', message: 'The model is busy right now. Try again in a moment.' }, stopReason: 'error' }, t(4)),
    ]),
    session('c4', 'Rewrite: water shutoff notice', HAIKU_ID, t(30), []),
    session('c5', 'Agenda for budget hearing prep', SONNET_ID, t(31), []),
    session('c6', 'Translate library hours into Spanish', QWEN_ID, t(60), []),
    session('c7', 'Explain the new records retention policy', SONNET_ID, t(70), []),
    session('c8', 'Summary of 2025 audit findings', OPUS_ID, t(24 * 45), []),
    session('c9', 'Grant application outline', SONNET_ID, t(24 * 52), [
      message('c9', 0, { role: 'user', content: 'Draft an outline for a grant application.' }, t(24 * 52)),
      message('c9', 1, { role: 'assistant', content: CANNED.general, modelId: SONNET_ID, latencyMs: 2400, stopReason: 'end_turn' }, t(24 * 52)),
    ]),
  ]
}

// Two-model compare session. Its turns carry modelId so the fork endpoint can split them.
function compareSession(now: number): MockSession {
  const at = now - 26 * HOUR_MS
  const prompt = 'Explain what a conflict-of-interest disclosure is, in two short paragraphs for new employees.'
  const answers: Array<[string, string]> = [
    [SONNET_ID, 'A conflict-of-interest disclosure is a short form where you tell the organization about anything that could make it hard to act in the public’s best interest. That might be a second job, a family member who does business with us, or a financial stake in a vendor.\n\nDisclosing something is not an accusation. It lets your manager decide whether anything needs to change.'],
    [GPT_ID, 'A conflict-of-interest disclosure is a written statement of any outside interest, relationship, or activity that might influence, or appear to influence, your work for the organization.\n\nThe purpose is transparency, not punishment. Once an interest is disclosed, the organization can put safeguards in place.'],
  ]
  const messages: Message[] = [message('c10', 0, { role: 'user', content: prompt, modelId: SONNET_ID }, at)]
  answers.forEach(([modelId, content], index) => {
    messages.push(message('c10', index + 1, { role: 'assistant', content, modelId, latencyMs: 2500, stopReason: 'end_turn' }, at))
  })
  messages.push(message('c10', 3, { role: 'user', content: prompt, modelId: GPT_ID }, at))
  return session('c10', 'Conflict-of-interest disclosure (compare)', SONNET_ID, at, messages, {
    mode: 'compare',
    modelIds: [SONNET_ID, GPT_ID],
  })
}

// Generated sessions fill the list past 50. Ages are spread across the sidebar groups.
function generatedSessions(now: number, count: number): MockSession[] {
  const ages = [1, 2, 4, 6, 10, 20, 26, 30, 40, 55, 80, 90]
  const models = [SONNET_ID, HAIKU_ID, MISTRAL_ID, NOVA_PRO_ID]
  return Array.from({ length: count }, (_, index) => {
    const id = `g${String(index + 1).padStart(3, '0')}`
    const topic = TOPICS[index % TOPICS.length]
    const round = Math.floor(index / TOPICS.length)
    const title = round === 0 ? topic : `${topic} (${round + 1})`
    const hoursAgo = index < 6 ? ages[index % ages.length] : 24 * ages[(index * 7) % ages.length] + index
    const at = now - hoursAgo * HOUR_MS - (index % 5) * 60_000
    const modelId = models[index % models.length]
    const messages = [
      message(id, 0, { role: 'user', content: `Help me with: ${title.toLowerCase()}.` }, at),
      message(id, 1, { role: 'assistant', content: CANNED.general, modelId, latencyMs: 2000, stopReason: 'end_turn' }, at),
    ]
    return session(id, title, modelId, at, messages)
  })
}

// Sorted newest first, as the API returns them.
export function seedSessions(now: number = Date.now()): MockSession[] {
  const all = [...prototypeSessions(now), compareSession(now), ...generatedSessions(now, 58)]
  return all.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
