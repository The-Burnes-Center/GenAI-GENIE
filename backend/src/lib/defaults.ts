import type { ModelEntry, Settings, Template } from "./types.js";

export const DEFAULT_MODEL_ID = "us.anthropic.claude-sonnet-5-5";
export const TITLE_MODEL_ID = "us.anthropic.claude-haiku-5-5";

/** retrievalTopK default before 2026-11-17; a stored value equal to it is treated as never customized. */
export const OLD_RETRIEVAL_TOP_K = 8;

/** Shown beside admin settings fields. */
export const SETTINGS_HELP = {
  timezone:
    "Midnight in this time zone resets the daily message limit. Changing it mid-day starts a fresh count for the new day.",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  appName: "Genie",
  welcomeTitle: "How can I help today?",
  welcomeMessage: "Chat with leading AI models, compare their answers, or ask questions about your own documents.",
  disclaimer: "AI can make mistakes. Check important information before relying on it.",
  defaultModelId: DEFAULT_MODEL_ID,
  dailyMessageLimit: 0,
  titleModelId: TITLE_MODEL_ID,
  maxCompareModels: 3,
  signupMode: "off",
  allowedEmailDomains: [],
  requireApproval: true,
  retrievalTopK: 15,
  timezone: "America/New_York",
  templateCategories: ["Writing", "Summaries", "Planning", "Communication", "Policy", "Translation"],
};

type Caps = ModelEntry["capabilities"];
const caps = (vision: boolean, documents: boolean, reasoning: boolean, temperature: boolean, promptCache: boolean): Caps => ({
  vision, documents, reasoning, temperature, promptCache,
});

type ModelSeed = Pick<ModelEntry, "modelId" | "label" | "provider" | "description" | "capabilities" | "contextWindow" | "maxOutputTokens">;

// Verified callable in us-east-1 on 2026-11-17. Non-Claude context windows are conservative estimates;
// the chat handler also recovers from a too-long rejection, so they are not trusted blindly.
const MODEL_SEEDS: ModelSeed[] = [
  { modelId: DEFAULT_MODEL_ID, label: "Claude Sonnet 5.5", provider: "Anthropic", description: "Balanced intelligence and speed. The default.", capabilities: caps(true, true, true, false, true), contextWindow: 1_000_000, maxOutputTokens: 128_000 },
  { modelId: "us.anthropic.claude-opus-5-5", label: "Claude Opus 5.5", provider: "Anthropic", description: "Most capable Claude model for hard problems.", capabilities: caps(true, true, true, false, true), contextWindow: 1_000_000, maxOutputTokens: 128_000 },
  { modelId: TITLE_MODEL_ID, label: "Claude Haiku 5.5", provider: "Anthropic", description: "Fastest and lowest cost Claude model.", capabilities: caps(true, true, true, false, true), contextWindow: 1_000_000, maxOutputTokens: 128_000 },
  { modelId: "global.openai.gpt-6.2-sol", label: "GPT-6.2 Sol", provider: "OpenAI", description: "OpenAI frontier model.", capabilities: caps(false, false, false, false, false), contextWindow: 200_000, maxOutputTokens: 32_000 },
  { modelId: "openai.gpt-oss-120b-1:0", label: "gpt-oss 120B", provider: "OpenAI", description: "Open-weight reasoning model.", capabilities: caps(false, false, false, true, false), contextWindow: 128_000, maxOutputTokens: 32_000 },
  { modelId: "us.amazon.nova-pro-v1:0", label: "Nova Pro", provider: "Amazon", description: "Amazon multimodal model.", capabilities: caps(true, true, false, true, true), contextWindow: 300_000, maxOutputTokens: 10_000 },
  { modelId: "us.amazon.nova-2-lite-v1:0", label: "Nova 2 Lite", provider: "Amazon", description: "Fast, low-cost Amazon multimodal model.", capabilities: caps(true, true, false, true, true), contextWindow: 300_000, maxOutputTokens: 32_000 },
  { modelId: "mistral.mistral-large-3-675b-instruct", label: "Mistral Large 3", provider: "Mistral AI", description: "Mistral flagship model.", capabilities: caps(false, false, false, true, false), contextWindow: 128_000, maxOutputTokens: 32_000 },
  { modelId: "deepseek.v3.2", label: "DeepSeek V3.2", provider: "DeepSeek", description: "DeepSeek general model.", capabilities: caps(false, false, false, true, false), contextWindow: 128_000, maxOutputTokens: 32_000 },
  { modelId: "qwen.qwen3-next-80b-a3b", label: "Qwen3 Next 80B", provider: "Qwen", description: "Qwen mixture-of-experts model.", capabilities: caps(false, false, false, true, false), contextWindow: 128_000, maxOutputTokens: 32_000 },
  { modelId: "global.xai.grok-4.7", label: "Grok 4.7", provider: "xAI", description: "xAI Grok model.", capabilities: caps(false, false, false, false, false), contextWindow: 128_000, maxOutputTokens: 32_000 },
];

export const DEFAULT_MODELS: ModelEntry[] = MODEL_SEEDS.map((m, i) => ({ enabled: true, sortOrder: (i + 1) * 10, ...m }));

export const DEFAULT_TEMPLATES: Template[] = [
  {
    templateId: "summarize",
    title: "Summarize a document",
    description: "Key points, decisions and open questions from pasted text or an attachment.",
    category: "Summaries",
    systemPrompt: "You summarize documents faithfully. Lead with a two sentence overview, then list key points, decisions and open questions. Never add facts that are not in the source.",
    starterPrompt: "Summarize the following:\n\n",
  },
  {
    templateId: "plain-language",
    title: "Rewrite in plain language",
    description: "Make text clear for a general audience without losing meaning.",
    category: "Writing",
    systemPrompt: "You are a plain language editor. Rewrite text at about an 8th grade reading level: short sentences, active voice, everyday words. Keep all facts and requirements intact.",
    starterPrompt: "Rewrite this in plain language:\n\n",
  },
  {
    templateId: "draft-email",
    title: "Draft an email",
    description: "A clear, courteous email from a few bullet points.",
    category: "Communication",
    systemPrompt: "You draft concise, professional emails. Provide a subject line, then the body. Keep the tone warm and direct, and end with a clear next step.",
    starterPrompt: "Draft an email about:\n\n",
  },
  {
    templateId: "meeting-actions",
    title: "Meeting notes to action items",
    description: "Turn raw notes into owners, actions and deadlines.",
    category: "Planning",
    systemPrompt: "You turn meeting notes into a tidy summary. Output: decisions made, action items as a table (owner, action, due date), and unresolved questions. Mark anything unclear as 'unconfirmed' rather than guessing.",
    starterPrompt: "Here are my meeting notes:\n\n",
  },
  {
    templateId: "translate",
    title: "Translate text",
    description: "Faithful translation that keeps tone and formatting.",
    category: "Translation",
    systemPrompt: "You are a professional translator. Translate faithfully, keep names, numbers and formatting, and preserve the tone. If the target language is not stated, ask which one.",
    starterPrompt: "Translate the following into (language):\n\n",
  },
  {
    templateId: "policy-brief",
    title: "Explain a policy",
    description: "What a policy requires, who it affects and what to do next.",
    category: "Policy",
    systemPrompt: "You explain policies and rules clearly. State what is required, who is affected, deadlines, and practical next steps. Quote the exact wording for obligations and flag anything ambiguous.",
    starterPrompt: "Explain this policy:\n\n",
  },
  {
    templateId: "brainstorm",
    title: "Brainstorm ideas",
    description: "A wide range of options, then a recommendation.",
    category: "Planning",
    systemPrompt: "You are a creative collaborator. Offer 8 varied ideas, from safe to bold, each with a one line rationale. Finish by recommending the best one and why.",
    starterPrompt: "Help me brainstorm ideas for:\n\n",
  },
].map((t, i) => ({ enabled: true, sortOrder: (i + 1) * 10, ...t }));
