// Settings, model catalog, templates and workspaces for mock mode. Values follow design/prototype/data.js
// and the defaults in ARCHITECTURE.md. Model ids are the Bedrock ids the chat API expects.
import type {
  AvailableModel,
  ModelConfig,
  ModelTestResult,
  Settings,
  Template,
  Workspace,
  WorkspaceDocument,
} from '../api/types'

export const SONNET_ID = 'us.anthropic.claude-sonnet-5-5'
export const OPUS_ID = 'us.anthropic.claude-opus-5-5'
export const HAIKU_ID = 'us.anthropic.claude-haiku-5-5'
export const GPT_ID = 'global.openai.gpt-6.2-sol'
export const OSS_ID = 'openai.gpt-oss-120b-1:0'
export const NOVA_PRO_ID = 'us.amazon.nova-pro-v1:0'
export const NOVA_LITE_ID = 'us.amazon.nova-2-lite-v1:0'
export const MISTRAL_ID = 'mistral.mistral-large-3-675b-instruct'
export const DEEPSEEK_ID = 'deepseek.v3.2'
export const QWEN_ID = 'qwen.qwen3-next-80b-a3b'
export const GROK_ID = 'global.xai.grok-4.7'

// Shown beside admin settings fields, as the server sends it.
export const SETTINGS_HELP: Record<string, string> = {
  timezone:
    'Midnight in this time zone resets the daily message limit. Changing it mid-day starts a fresh count for the new day.',
}

export const SEED_NOW_ISO = '2026-11-17T14:00:00.000Z'

export function initialSettings(): Settings {
  return {
    appName: 'Genie',
    welcomeTitle: 'Welcome to Genie',
    welcomeMessage:
      'Ask a question, draft a message, or work from your team’s documents. Your chats are saved to your history.',
    disclaimer: 'Genie can make mistakes. Check important facts before you share or act on them.',
    defaultModelId: SONNET_ID,
    titleModelId: HAIKU_ID,
    dailyMessageLimit: 50,
    maxCompareModels: 3,
    signupMode: 'open',
    allowedEmailDomains: ['example.org', 'example.gov'],
    requireApproval: true,
    retrievalTopK: 8,
    timezone: 'America/New_York',
    templateCategories: ['Writing', 'Summaries', 'Planning', 'Communication', 'Policy', 'Translation'],
  }
}

const CLAUDE_CAPS = { vision: true, documents: true, reasoning: true, temperature: false, promptCache: true }

function model(
  partial: Pick<ModelConfig, 'modelId' | 'label' | 'provider' | 'description' | 'capabilities' | 'contextWindow' | 'maxOutputTokens' | 'sortOrder'> &
    Partial<Pick<ModelConfig, 'enabled'>>,
): ModelConfig {
  return { enabled: true, ...partial }
}

export function initialModels(): ModelConfig[] {
  return [
    model({ modelId: SONNET_ID, label: 'Claude Sonnet 5.5', provider: 'Anthropic', description: 'Balanced and careful. Good for most work.', capabilities: CLAUDE_CAPS, contextWindow: 1_000_000, maxOutputTokens: 128_000, sortOrder: 1 }),
    model({ modelId: OPUS_ID, label: 'Claude Opus 5.5', provider: 'Anthropic', description: 'Most thorough. Best for hard, detailed tasks.', capabilities: CLAUDE_CAPS, contextWindow: 1_000_000, maxOutputTokens: 128_000, sortOrder: 2 }),
    model({ modelId: HAIKU_ID, label: 'Claude Haiku 5.5', provider: 'Anthropic', description: 'Fastest. Good for quick questions.', capabilities: CLAUDE_CAPS, contextWindow: 1_000_000, maxOutputTokens: 128_000, sortOrder: 3 }),
    model({ modelId: GPT_ID, label: 'GPT-6.2 Sol', provider: 'OpenAI', description: 'Strong all-rounder for writing and analysis.', capabilities: { vision: false, documents: false, reasoning: false, temperature: false, promptCache: false }, contextWindow: 200_000, maxOutputTokens: 32_000, sortOrder: 4 }),
    model({ modelId: OSS_ID, label: 'gpt-oss 120B', provider: 'OpenAI', description: 'Open model. Quick, plain answers.', capabilities: { vision: false, documents: false, reasoning: false, temperature: true, promptCache: false }, contextWindow: 128_000, maxOutputTokens: 32_000, sortOrder: 5 }),
    model({ modelId: NOVA_PRO_ID, label: 'Nova Pro', provider: 'Amazon', description: 'Reads documents and images well.', capabilities: { vision: true, documents: true, reasoning: false, temperature: true, promptCache: true }, contextWindow: 300_000, maxOutputTokens: 10_000, sortOrder: 6 }),
    model({ modelId: NOVA_LITE_ID, label: 'Nova 2 Lite', provider: 'Amazon', description: 'Light and fast for everyday tasks.', capabilities: { vision: true, documents: true, reasoning: false, temperature: true, promptCache: true }, contextWindow: 300_000, maxOutputTokens: 32_000, sortOrder: 7 }),
    model({ modelId: MISTRAL_ID, label: 'Mistral Large 3', provider: 'Mistral AI', description: 'Strong with European languages.', capabilities: { vision: false, documents: false, reasoning: false, temperature: true, promptCache: false }, contextWindow: 128_000, maxOutputTokens: 32_000, sortOrder: 8 }),
    model({ modelId: DEEPSEEK_ID, label: 'DeepSeek V3.2', provider: 'DeepSeek', description: 'Good at step-by-step reasoning.', capabilities: { vision: false, documents: false, reasoning: false, temperature: true, promptCache: false }, contextWindow: 128_000, maxOutputTokens: 32_000, sortOrder: 9, enabled: false }),
    model({ modelId: QWEN_ID, label: 'Qwen3 Next 80B', provider: 'Qwen', description: 'Good at translation and long text.', capabilities: { vision: false, documents: false, reasoning: false, temperature: true, promptCache: false }, contextWindow: 128_000, maxOutputTokens: 32_000, sortOrder: 10 }),
    model({ modelId: GROK_ID, label: 'Grok 4.7', provider: 'xAI', description: 'Direct style, broad general knowledge.', capabilities: { vision: false, documents: false, reasoning: false, temperature: false, promptCache: false }, contextWindow: 128_000, maxOutputTokens: 32_000, sortOrder: 11 }),
  ]
}

export const MODEL_TEST_RESULTS: Record<string, ModelTestResult> = {
  [SONNET_ID]: { ok: true, latencyMs: 1180 },
  [OPUS_ID]: { ok: true, latencyMs: 2040 },
  [HAIKU_ID]: { ok: true, latencyMs: 640 },
  [GPT_ID]: { ok: true, latencyMs: 1320 },
  [OSS_ID]: { ok: true, latencyMs: 900 },
  [NOVA_PRO_ID]: { ok: true, latencyMs: 1010 },
  [MISTRAL_ID]: { ok: true, latencyMs: 1450 },
  [DEEPSEEK_ID]: { ok: true, latencyMs: 1700 },
  [GROK_ID]: { ok: false, latencyMs: 310, error: 'Access to this model is not turned on for this AWS account.' },
}

export const AVAILABLE_MODELS: AvailableModel[] = [
  { modelId: 'us.meta.llama4-maverick-17b-instruct-v1:0', label: 'Llama 4 Maverick', provider: 'Meta', kind: 'profile' },
  { modelId: 'cohere.command-r-plus-v1:0', label: 'Command R+', provider: 'Cohere', kind: 'model' },
  { modelId: 'ai21.jamba-1-5-large-v1:0', label: 'Jamba 1.5 Large', provider: 'AI21 Labs', kind: 'model' },
  { modelId: 'us.writer.palmyra-x5-v1:0', label: 'Palmyra X5', provider: 'Writer', kind: 'profile' },
]

const TEMPLATE_SEED: Array<Omit<Template, 'sortOrder'>> = [
  { templateId: 't1', title: 'Summarize a document', description: 'Short summary with the key points and any deadlines.', category: 'Summaries', starterPrompt: 'Summarize the attached document in plain language. List the key points and any dates or deadlines.', enabled: true, systemPrompt: 'You summarize documents for busy public-sector staff. Be accurate, brief and neutral. Always list dates and deadlines separately.' },
  { templateId: 't2', title: 'Plain-language rewrite', description: 'Turn formal or technical text into clear, friendly wording.', category: 'Communication', starterPrompt: 'Rewrite the following in plain language at about an 8th-grade reading level. Keep every fact.\n\n[paste text here]', enabled: true, systemPrompt: 'You rewrite text in plain language. Short sentences, active voice, no jargon. Never change facts or numbers.' },
  { templateId: 't3', title: 'Draft an email', description: 'A polite, clear first draft you can edit.', category: 'Writing', starterPrompt: 'Draft a short, polite email to [who] about [topic]. The tone should be [friendly / formal].', enabled: true, systemPrompt: 'You draft professional emails for government and nonprofit staff. Keep them short and courteous.' },
  { templateId: 't4', title: 'Meeting agenda', description: 'A timed agenda from a few notes about the meeting.', category: 'Planning', starterPrompt: 'Create a [30 / 60] minute agenda for a meeting about [topic]. Attendees: [roles].', enabled: true, systemPrompt: 'You create realistic, timed meeting agendas with a clear goal for each item.' },
  { templateId: 't5', title: 'Action items from notes', description: 'Pull out who does what, and by when.', category: 'Planning', starterPrompt: 'List the action items from these meeting notes. For each one, give the owner and the due date if mentioned.\n\n[paste notes here]', enabled: true, systemPrompt: 'You extract action items. If an owner or date is missing, say so instead of guessing.' },
  { templateId: 't6', title: 'Translate', description: 'Translate text and keep the tone.', category: 'Translation', starterPrompt: 'Translate the following into [language]. Keep the tone friendly and formal.\n\n[paste text here]', enabled: true, systemPrompt: 'You translate accurately and naturally. Mention any phrase that has no direct equivalent.' },
  { templateId: 't7', title: 'Policy explainer', description: 'Explain a policy to staff or residents in everyday words.', category: 'Policy', starterPrompt: 'Explain this policy to [staff / residents] in everyday words. Say what changed, who is affected, and what they need to do.', enabled: true, systemPrompt: 'You explain policies clearly and neutrally. Never give legal advice.' },
  { templateId: 't8', title: 'Resident FAQ from a policy', description: 'Likely questions and short answers, ready to post.', category: 'Policy', starterPrompt: 'Write 8 frequently asked questions with short answers based on the attached policy.', enabled: true, systemPrompt: 'You write FAQs in plain language. Only use facts from the supplied document.' },
  { templateId: 't9', title: 'Press release first draft', description: 'A first draft with a headline, summary and quote placeholder.', category: 'Writing', starterPrompt: 'Write a first draft press release about [announcement]. Include a headline, a two-sentence summary, and a placeholder for a quote from [name, title].', enabled: true, systemPrompt: 'You write clear, factual press releases in a neutral public-sector voice.' },
  { templateId: 't10', title: 'Pros and cons memo', description: 'Compare two options fairly in one page.', category: 'Policy', starterPrompt: 'Compare [option A] and [option B] for [decision]. Give pros, cons, costs and a neutral recommendation.', enabled: false, systemPrompt: 'You write balanced decision memos. Be explicit about uncertainty.' },
]

export function initialTemplates(): Template[] {
  return TEMPLATE_SEED.map((template, index) => ({ ...template, sortOrder: index + 1 }))
}

const DOCUMENT_TYPE = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

function doc(workspaceId: string, docId: string, name: string, type: keyof typeof DOCUMENT_TYPE, size: number, createdAt: string, status: WorkspaceDocument['status'], error?: string): WorkspaceDocument {
  return { docId, workspaceId, name, contentType: DOCUMENT_TYPE[type], size, s3Key: `workspaces/${workspaceId}/${docId}/source.${type}`, status, createdAt, ...(error ? { error } : {}) }
}

export function initialDocuments(): Record<string, WorkspaceDocument[]> {
  return {
    w1: [
      doc('w1', 'd1', 'Parental-Leave-Policy-2026.pdf', 'pdf', 412_000, '2026-09-03T15:00:00.000Z', 'ready'),
      doc('w1', 'd2', 'Remote-Work-Guidelines.docx', 'docx', 96_000, '2026-09-03T15:05:00.000Z', 'ready'),
      doc('w1', 'd3', 'Benefits-Overview.pdf', 'pdf', 2_100_000, '2026-11-17T13:30:00.000Z', 'indexing'),
      doc('w1', 'd4', 'Holiday-Schedule.xlsx', 'xlsx', 38_000, '2026-11-17T13:40:00.000Z', 'uploaded'),
      doc('w1', 'd5', 'Old-Handbook-Scan.pdf', 'pdf', 18_400_000, '2026-09-03T15:10:00.000Z', 'failed', 'Genie couldn’t find any text in this file. It may be a scan. Upload a text-based PDF instead.'),
    ],
    w2: [
      doc('w2', 'd6', 'Permit-Fee-Schedule-2026.pdf', 'pdf', 286_000, '2026-08-19T16:00:00.000Z', 'ready'),
      doc('w2', 'd7', 'Review-Steps.docx', 'docx', 74_000, '2026-08-19T16:10:00.000Z', 'ready'),
    ],
    w3: [doc('w3', 'd8', 'Agenda-2026-11-04.pdf', 'pdf', 530_000, '2026-11-02T12:00:00.000Z', 'ready')],
    w4: [doc('w4', 'd9', 'Grant-Draft-v3.docx', 'docx', 120_000, '2026-11-02T12:30:00.000Z', 'ready')],
  }
}

export function initialWorkspaces(documents: Record<string, WorkspaceDocument[]>): Workspace[] {
  const row = (workspaceId: string, name: string, description: string, visibility: Workspace['visibility'], ownerEmail: string, createdAt: string): Workspace => ({
    workspaceId,
    name,
    description,
    visibility,
    ownerSub: visibility === 'personal' ? 'mock-user' : 'mock-admin',
    ownerEmail,
    createdAt,
    docCount: documents[workspaceId]?.length ?? 0,
  })
  return [
    row('w1', 'HR handbook', 'Leave, benefits, conduct and workplace policies.', 'shared', 'hr.team@example.org', '2026-09-03T14:00:00.000Z'),
    row('w2', 'Permits and licensing guide', 'Forms, fees and review steps for common permits.', 'shared', 'permits@example.org', '2026-08-19T14:00:00.000Z'),
    row('w3', 'Council meeting packets', 'Agendas and supporting documents for 2026.', 'shared', 'clerk@example.org', '2026-01-08T14:00:00.000Z'),
    row('w4', 'My grant drafts', 'Working copies of grant applications.', 'personal', 'staff.member@example.org', '2026-11-02T14:00:00.000Z'),
  ]
}
