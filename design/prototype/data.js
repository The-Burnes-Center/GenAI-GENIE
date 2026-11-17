/* Sample data for the Genie prototype. All names, emails and numbers are invented. */
'use strict';

const SETTINGS = {
  appName: 'Genie',
  welcomeTitle: 'Welcome to Genie',
  welcomeMessage: 'Ask a question, draft a message, or work from your team’s documents. Your chats are saved to your history.',
  disclaimer: 'Genie can make mistakes. Check important facts before you share or act on them.',
  defaultModelId: 'sonnet',
  titleModelId: 'haiku',
  dailyMessageLimit: 50,
  maxCompareModels: 3,
  signupMode: 'open',
  allowedEmailDomains: ['example.org', 'example.gov'],
  requireApproval: true,
  retrievalTopK: 8,
};

// vision: reads images. docs: reads PDFs and Word files natively (otherwise text is extracted). think: can think harder.
const MODELS = [
  { id: 'sonnet', label: 'Claude Sonnet 5.5', provider: 'Anthropic', desc: 'Balanced and careful. Good for most work.', vision: true, docs: true, think: true, enabled: true, test: { ok: true, ms: 1180 }, bedrock: 'us.anthropic.claude-sonnet-5-5' },
  { id: 'opus', label: 'Claude Opus 5.5', provider: 'Anthropic', desc: 'Most thorough. Best for hard, detailed tasks.', vision: true, docs: true, think: true, enabled: true, test: { ok: true, ms: 2040 }, bedrock: 'us.anthropic.claude-opus-5-5' },
  { id: 'haiku', label: 'Claude Haiku 5.5', provider: 'Anthropic', desc: 'Fastest. Good for quick questions.', vision: true, docs: true, think: true, enabled: true, test: { ok: true, ms: 640 }, bedrock: 'us.anthropic.claude-haiku-5-5' },
  { id: 'gpt', label: 'GPT-6.2 Sol', provider: 'OpenAI', desc: 'Strong all-rounder for writing and analysis.', vision: false, docs: false, think: false, enabled: true, test: { ok: true, ms: 1320 }, bedrock: 'global.openai.gpt-6.2-sol' },
  { id: 'oss', label: 'gpt-oss 120B', provider: 'OpenAI', desc: 'Open model. Quick, plain answers.', vision: false, docs: false, think: false, enabled: true, test: { ok: true, ms: 900 }, bedrock: 'openai.gpt-oss-120b-1:0' },
  { id: 'nova', label: 'Nova Pro', provider: 'Amazon', desc: 'Reads documents and images well.', vision: true, docs: true, think: false, enabled: true, test: { ok: true, ms: 1010 }, bedrock: 'us.amazon.nova-pro-v1:0' },
  { id: 'novalite', label: 'Nova 2 Lite', provider: 'Amazon', desc: 'Light and fast for everyday tasks.', vision: true, docs: true, think: false, enabled: true, test: null, bedrock: 'us.amazon.nova-2-lite-v1:0' },
  { id: 'mistral', label: 'Mistral Large 3', provider: 'Mistral AI', desc: 'Strong with European languages.', vision: false, docs: false, think: false, enabled: true, test: { ok: true, ms: 1450 }, bedrock: 'mistral.mistral-large-3-675b-instruct' },
  { id: 'deepseek', label: 'DeepSeek V3.2', provider: 'DeepSeek', desc: 'Good at step-by-step reasoning.', vision: false, docs: false, think: false, enabled: false, test: { ok: true, ms: 1700 }, bedrock: 'deepseek.v3.2' },
  { id: 'qwen', label: 'Qwen3 Next 80B', provider: 'Qwen', desc: 'Good at translation and long text.', vision: false, docs: false, think: false, enabled: true, test: null, bedrock: 'qwen.qwen3-next-80b-a3b' },
  { id: 'grok', label: 'Grok 4.7', provider: 'xAI', desc: 'Direct style, broad general knowledge.', vision: false, docs: false, think: false, enabled: true, test: { ok: false, error: 'Access to this model is not turned on for this AWS account.' }, bedrock: 'global.xai.grok-4.7' },
];
const PROVIDER_ORDER = ['Anthropic', 'OpenAI', 'Amazon', 'Mistral AI', 'DeepSeek', 'Qwen', 'xAI'];

const AVAILABLE_MODELS = [
  { id: 'us.meta.llama4-maverick-17b-instruct-v1:0', provider: 'Meta', label: 'Llama 4 Maverick' },
  { id: 'cohere.command-r-plus-v1:0', provider: 'Cohere', label: 'Command R+' },
  { id: 'ai21.jamba-1-5-large-v1:0', provider: 'AI21 Labs', label: 'Jamba 1.5 Large' },
  { id: 'us.writer.palmyra-x5-v1:0', provider: 'Writer', label: 'Palmyra X5' },
];

const CATEGORIES = ['Writing', 'Summarizing', 'Plain language', 'Meetings', 'Policy', 'Translation'];
const TEMPLATES = [
  { id: 't1', title: 'Summarize a document', category: 'Summarizing', desc: 'Short summary with the key points and any deadlines.', starter: 'Summarize the attached document in plain language. List the key points and any dates or deadlines.', enabled: true, system: 'You summarize documents for busy public-sector staff. Be accurate, brief and neutral. Always list dates and deadlines separately.' },
  { id: 't2', title: 'Plain-language rewrite', category: 'Plain language', desc: 'Turn formal or technical text into clear, friendly wording.', starter: 'Rewrite the following in plain language at about an 8th-grade reading level. Keep every fact.\n\n[paste text here]', enabled: true, system: 'You rewrite text in plain language. Short sentences, active voice, no jargon. Never change facts or numbers.' },
  { id: 't3', title: 'Draft an email', category: 'Writing', desc: 'A polite, clear first draft you can edit.', starter: 'Draft a short, polite email to [who] about [topic]. The tone should be [friendly / formal].', enabled: true, system: 'You draft professional emails for government and nonprofit staff. Keep them short and courteous.' },
  { id: 't4', title: 'Meeting agenda', category: 'Meetings', desc: 'A timed agenda from a few notes about the meeting.', starter: 'Create a [30 / 60] minute agenda for a meeting about [topic]. Attendees: [roles].', enabled: true, system: 'You create realistic, timed meeting agendas with a clear goal for each item.' },
  { id: 't5', title: 'Action items from notes', category: 'Meetings', desc: 'Pull out who does what, and by when.', starter: 'List the action items from these meeting notes. For each one, give the owner and the due date if mentioned.\n\n[paste notes here]', enabled: true, system: 'You extract action items. If an owner or date is missing, say so instead of guessing.' },
  { id: 't6', title: 'Translate', category: 'Translation', desc: 'Translate text and keep the tone.', starter: 'Translate the following into [language]. Keep the tone friendly and formal.\n\n[paste text here]', enabled: true, system: 'You translate accurately and naturally. Mention any phrase that has no direct equivalent.' },
  { id: 't7', title: 'Policy explainer', category: 'Policy', desc: 'Explain a policy to staff or residents in everyday words.', starter: 'Explain this policy to [staff / residents] in everyday words. Say what changed, who is affected, and what they need to do.', enabled: true, system: 'You explain policies clearly and neutrally. Never give legal advice.' },
  { id: 't8', title: 'Resident FAQ from a policy', category: 'Policy', desc: 'Likely questions and short answers, ready to post.', starter: 'Write 8 frequently asked questions with short answers based on the attached policy.', enabled: true, system: 'You write FAQs in plain language. Only use facts from the supplied document.' },
  { id: 't9', title: 'Press release first draft', category: 'Writing', desc: 'A first draft with a headline, summary and quote placeholder.', starter: 'Write a first draft press release about [announcement]. Include a headline, a two-sentence summary, and a placeholder for a quote from [name, title].', enabled: true, system: 'You write clear, factual press releases in a neutral public-sector voice.' },
  { id: 't10', title: 'Pros and cons memo', category: 'Policy', desc: 'Compare two options fairly in one page.', starter: 'Compare [option A] and [option B] for [decision]. Give pros, cons, costs and a neutral recommendation.', enabled: false, system: 'You write balanced decision memos. Be explicit about uncertainty.' },
];

const WORKSPACES = [
  { id: 'w1', name: 'HR handbook', desc: 'Leave, benefits, conduct and workplace policies.', vis: 'shared', owner: 'hr.team@example.org', docs: 5, created: 'Sep 3' },
  { id: 'w2', name: 'Permits and licensing guide', desc: 'Forms, fees and review steps for common permits.', vis: 'shared', owner: 'permits@example.org', docs: 8, created: 'Aug 19' },
  { id: 'w3', name: 'Council meeting packets', desc: 'Agendas and supporting documents for 2026.', vis: 'shared', owner: 'clerk@example.org', docs: 22, created: 'Jan 8' },
  { id: 'w4', name: 'My grant drafts', desc: 'Working copies of grant applications.', vis: 'personal', owner: 'staff.member@example.org', docs: 3, created: 'Nov 2' },
];
const DOCS = {
  w1: [
    { id: 'd1', name: 'Parental-Leave-Policy-2026.pdf', type: 'pdf', size: '412 KB', added: 'Sep 3', status: 'ready' },
    { id: 'd2', name: 'Remote-Work-Guidelines.docx', type: 'doc', size: '96 KB', added: 'Sep 3', status: 'ready' },
    { id: 'd3', name: 'Benefits-Overview.pdf', type: 'pdf', size: '2.1 MB', added: 'Today', status: 'indexing' },
    { id: 'd4', name: 'Holiday-Schedule.xlsx', type: 'xls', size: '38 KB', added: 'Today', status: 'uploaded' },
    { id: 'd5', name: 'Old-Handbook-Scan.pdf', type: 'pdf', size: '18.4 MB', added: 'Sep 3', status: 'failed', error: 'Genie couldn’t find any text in this file. It may be a scan. Upload a text-based PDF instead.' },
  ],
};

const CITES_LEAVE = [
  { title: 'Parental-Leave-Policy-2026.pdf', ws: 'HR handbook', snippet: 'Eligible employees receive twelve (12) weeks of paid parental leave following the birth, adoption, or foster placement of a child.' },
  { title: 'Parental-Leave-Policy-2026.pdf', ws: 'HR handbook', snippet: 'Leave may be taken in one continuous period or in shorter periods, provided all leave is used within twelve months of the child’s arrival.' },
  { title: 'Leave-Request-Procedures.docx', ws: 'HR handbook', snippet: 'Employees should give at least thirty (30) days’ notice of planned leave whenever possible.' },
];

const MD_SNOW = `Here is a plain-language summary for the front desk.

## What changed this year

- **Parking bans start earlier.** The ban now begins at 7 p.m. instead of 9 p.m. when four or more inches of snow are forecast.
- **Warming centers open sooner.** Two library branches open as warming centers when the temperature falls below 20 degrees.
- **One alert system.** Residents get text alerts through a single sign-up instead of three separate lists.

## What residents need to do

| Action | Who | By when |
|---|---|---|
| Move cars off marked snow routes | Anyone parked on a snow route | Before the ban starts |
| Clear the sidewalk in front of the home | Property owners | Within 6 hours after snow stops |
| Sign up for text alerts | Everyone | Before December 1 |

## A short script for the front desk

"The parking ban now starts at 7 p.m. when heavy snow is forecast. You can check your street on the map, or sign up for text alerts at the link on our website."

The parking map shows the snow routes in blue. I could not read the street names in the lower-right corner, so please check those against the original.`;

const MD_FORMULA = `Assuming the dates are in column B and the status is in column D, use this formula:

\`\`\`excel
=COUNTIFS(D:D,"Open",B:B,"<"&TODAY()-3)
\`\`\`

It counts rows where the status is "Open" and the date is more than 3 days ago. Change \`D:D\` and \`B:B\` if your columns are different.`;

const MD_LEAVE = `Eligible employees get **12 weeks** of paid parental leave after a birth, adoption, or foster placement [1]. You can take it in one block or split it into shorter periods, as long as all of it is used within 12 months of the child’s arrival [2].

A few things to know:

- You need to have worked here for at least 6 months to qualify.
- Give your manager at least 30 days’ notice when you can [3].
- Part-time staff receive leave in proportion to their regular hours.

For your own situation, confirm the details with Human Resources.`;

const THINK_SNOW = 'The person wants a summary for front-desk staff, so the reader is not an expert. I should lead with what changed, then what residents must do, and keep the wording simple. The table is the clearest way to show who does what and by when. The map image is partly unreadable in one corner, so I should say that instead of guessing.';

const SESSIONS = [
  { id: 'c1', title: 'Snow emergency plan summary', group: 'Today', model: 'sonnet', msgs: [
    { role: 'user', text: 'Summarize the key changes in this plan for front-desk staff, in plain language. What do residents need to do?', attach: [{ name: 'Snow-Emergency-Plan-2026.pdf', type: 'pdf', size: '1.8 MB' }, { name: 'parking-map.png', type: 'img', size: '640 KB' }] },
    { role: 'assistant', model: 'sonnet', md: MD_SNOW, think: { text: THINK_SNOW, secs: 9 }, latency: '11.4 s' },
    { role: 'user', text: 'Can you give me a spreadsheet formula that counts open snow-route complaints older than 3 days?' },
    { role: 'assistant', model: 'sonnet', md: MD_FORMULA, latency: '3.1 s' },
  ] },
  { id: 'c2', title: 'Parental leave questions', group: 'Today', model: 'sonnet', ws: 'w1', msgs: [
    { role: 'user', text: 'How many weeks of paid parental leave do new parents get, and can it be split up?' },
    { role: 'assistant', model: 'sonnet', md: MD_LEAVE, cites: CITES_LEAVE, latency: '4.2 s' },
  ] },
  { id: 'c3', title: 'Draft email to vendor about late delivery', group: 'Today', model: 'opus', msgs: [
    { role: 'user', text: 'Draft an email to the vendor about the late delivery of the office chairs.' },
    { role: 'assistant', model: 'opus', err: 'BEDROCK_THROTTLED' },
  ] },
  { id: 'c4', title: 'Rewrite: water shutoff notice', group: 'Yesterday', model: 'haiku' },
  { id: 'c5', title: 'Agenda for budget hearing prep', group: 'Yesterday', model: 'sonnet' },
  { id: 'c6', title: 'Translate library hours into Spanish', group: 'Previous 7 days', model: 'qwen' },
  { id: 'c7', title: 'Explain the new records retention policy', group: 'Previous 7 days', model: 'sonnet' },
  { id: 'c8', title: 'Summary of 2025 audit findings', group: 'Older', model: 'opus' },
  { id: 'c9', title: 'Grant application outline', group: 'Older', model: 'sonnet' },
];

const COMPARE = {
  prompt: 'Explain what a conflict-of-interest disclosure is, in two short paragraphs for new employees.',
  answers: {
    sonnet: { secs: 3.4, md: 'A conflict-of-interest disclosure is a short form where you tell the organization about anything that could make it hard to act in the public’s best interest. That might be a second job, a family member who does business with us, or a financial stake in a vendor.\n\nDisclosing something is not an accusation. It lets your manager decide whether anything needs to change, such as having someone else handle a decision. Most disclosures are resolved quickly, and filing one early is always better than staying quiet.' },
    gpt: { secs: 1.9, md: 'A conflict-of-interest disclosure is a written statement of any outside interest, relationship, or activity that might influence, or appear to influence, your work for the organization. Staff typically file one when they are hired and again each year.\n\nThe purpose is transparency, not punishment. Once an interest is disclosed, the organization can put safeguards in place, like removing you from a particular decision, so that public trust is protected.' },
    nova: { secs: 2.4, md: 'A conflict-of-interest disclosure is a form where you list outside interests that could overlap with your job, such as business ownership, board seats, or close relatives who work with vendors.\n\nFiling it protects you and the organization. If a conflict comes up, your manager can adjust your duties early. New employees usually complete the form in their first month.' },
  },
};

const USERS = [
  { id: 'u1', email: 'staff.member@example.org', role: 'admin', status: 'active', last: 'Today', self: true },
  { id: 'u2', email: 'records.clerk@example.org', role: 'user', status: 'active', last: 'Today' },
  { id: 'u3', email: 'front.desk@example.org', role: 'user', status: 'active', last: 'Yesterday' },
  { id: 'u4', email: 'planning.analyst@example.org', role: 'user', status: 'active', last: 'Nov 12' },
  { id: 'u5', email: 'communications@example.org', role: 'admin', status: 'active', last: 'Nov 10' },
  { id: 'u6', email: 'new.hire@example.org', role: 'user', status: 'invited', last: 'Never signed in' },
  { id: 'u7', email: 'former.contractor@example.org', role: 'user', status: 'suspended', last: 'Oct 2' },
];
const PENDING = [
  { id: 'p1', email: 'budget.office@example.org', when: 'Today, 9:12 a.m.' },
  { id: 'p2', email: 'parks.dept@example.gov', when: 'Yesterday, 4:40 p.m.' },
];

const USAGE_DAYS = [38, 52, 61, 44, 0, 0, 47, 88, 120, 134, 109, 126, 187, 143];
const USAGE_MODELS = [
  { model: 'Claude Sonnet 5.5', msgs: 612, inT: '1.9M', outT: '0.84M' },
  { model: 'Claude Haiku 5.5', msgs: 214, inT: '0.31M', outT: '0.12M' },
  { model: 'GPT-6.2 Sol', msgs: 98, inT: '0.22M', outT: '0.09M' },
  { model: 'Nova Pro', msgs: 61, inT: '0.40M', outT: '0.05M' },
  { model: 'Claude Opus 5.5', msgs: 33, inT: '0.28M', outT: '0.11M' },
];
const USAGE_USERS = [
  { email: 'records.clerk@example.org', msgs: 241, tok: '0.9M' },
  { email: 'planning.analyst@example.org', msgs: 203, tok: '1.2M' },
  { email: 'front.desk@example.org', msgs: 188, tok: '0.4M' },
  { email: 'communications@example.org', msgs: 152, tok: '0.7M' },
  { email: 'staff.member@example.org', msgs: 106, tok: '0.5M' },
  { email: 'budget.office@example.org', msgs: 28, tok: '0.1M' },
];

const FEEDBACK = [
  { id: 'f1', when: 'Today, 10:04 a.m.', user: 'front.desk@example.org', model: 'GPT-6.2 Sol', comment: 'The date it gave for the filing deadline was wrong.', prompt: 'When is the annual business license renewal due?', response: 'Annual business licenses must be renewed by March 31 each year. Late fees begin on April 1...' },
  { id: 'f2', when: 'Yesterday, 2:18 p.m.', user: 'records.clerk@example.org', model: 'Claude Haiku 5.5', comment: '', prompt: 'Summarize this 40 page report in one paragraph.', response: 'The report reviews three years of records requests and finds that response times improved...' },
  { id: 'f3', when: 'Nov 12, 3:51 p.m.', user: 'planning.analyst@example.org', model: 'Mistral Large 3', comment: 'Too wordy. I asked for three bullet points.', prompt: 'Give me three bullet points on the zoning change.', response: 'Certainly! The zoning change, which was approved by the commission after extensive review, includes several...' },
];
const AUDIT = [
  { when: 'Today, 9:30 a.m.', who: 'staff.member@example.org', action: 'Changed settings', target: 'Sign-up', details: 'Require approval: on' },
  { when: 'Today, 9:02 a.m.', who: 'staff.member@example.org', action: 'Tested model', target: 'Grok 4.7', details: 'Failed: access not enabled' },
  { when: 'Yesterday, 4:10 p.m.', who: 'communications@example.org', action: 'Edited template', target: 'Press release first draft', details: 'Starter prompt changed' },
  { when: 'Nov 12, 11:20 a.m.', who: 'staff.member@example.org', action: 'Invited user', target: 'new.hire@example.org', details: 'Role: user' },
  { when: 'Nov 10, 1:05 p.m.', who: 'staff.member@example.org', action: 'Turned off model', target: 'DeepSeek V3.2', details: 'Enabled: off' },
  { when: 'Nov 3, 8:44 a.m.', who: 'staff.member@example.org', action: 'Suspended user', target: 'former.contractor@example.org', details: 'Status: suspended' },
];
const PASSKEYS = [
  { id: 'k1', name: 'MacBook Pro (Touch ID)', added: 'Oct 12, 2026' },
  { id: 'k2', name: 'Security key (USB)', added: 'Sep 2, 2026' },
];

const CANNED = {
  general: 'Here is a first draft you can adjust.\n\n## Draft\n\nThank you for your message. I have reviewed your request and have three points to cover.\n\n- **Timing:** Confirm the date and who is responsible.\n- **Next step:** Say clearly what you need from the reader.\n- **Contact:** Add the best way to reach you.\n\nTell me the audience and tone you want, and I will tighten this up.',
  grounded: MD_LEAVE,
  think: 'The question is short and the answer should be direct. I will start with the main point, then add only the details that change what the person should do. I should keep the wording plain and avoid hedging unless something is really unclear.',
  thinkDeep: 'Let me work out what is being asked and what could go wrong. First, restate the goal in plain terms. Second, list the facts I am sure of, and the ones I am not. Third, check whether any step depends on a date or a number that I should flag. The simplest correct answer is probably better than a long one, but I should mention the one assumption that matters. Finally, I will keep the tone calm and practical for someone who is not an expert.',
};

const ERRORS = {
  BEDROCK_THROTTLED: { title: (m) => m + ' is busy right now.', body: 'A lot of people are using it. Wait a moment and try again, or choose another model. Your message was saved.', actions: ['retry', 'model'] },
  CONTEXT_TOO_LONG: { title: (m) => 'That is too much for ' + m + ' to read at once.', body: 'Attach the text as a file instead of pasting it, or choose a model that can read more.', actions: ['model'] },
  REFUSED: { title: (m) => m + ' declined to answer this one.', body: 'Its safety filters stopped the reply. Try rephrasing your request, or choose another model.', actions: ['retry', 'model'] },
  BEDROCK_ERROR: { title: () => 'Something went wrong on our side.', body: 'Your message was saved. Try again in a moment.', actions: ['retry'] },
};
