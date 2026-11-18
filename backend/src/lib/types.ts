/** `deleted` is a short-lived tombstone (TTL) so a deleted user's still-valid token stops working. */
export type ProfileStatus = "active" | "pending" | "suspended" | "deleted";

export interface AuthUser {
  sub: string;
  email: string;
  isAdmin: boolean;
  status: ProfileStatus;
  /** Cognito username (the uuid for email sign-in pools). */
  username: string;
}

export interface Settings {
  appName: string;
  welcomeTitle: string;
  welcomeMessage: string;
  disclaimer: string;
  defaultModelId: string;
  /** 0 = unlimited */
  dailyMessageLimit: number;
  maxCompareModels: number;
  titleModelId: string;
  signupMode: "off" | "open";
  /** Empty = any domain. */
  allowedEmailDomains: string[];
  requireApproval: boolean;
  retrievalTopK: number;
  /** IANA zone whose midnight ends the daily message limit. */
  timezone: string;
  templateCategories: string[];
  /** Base instructions sent to the model with every chat, before any template's own prompt. */
  assistantInstructions: string;
  /** "What not to share" rules shown to staff on first run and on the Learn page. */
  dataRules: string[];
  /** Training and help links on the Learn page. */
  learnLinks: LearnLink[];
  /** Email address or https URL where staff can reach a person for help. Empty hides it. */
  helpContact: string;
}

export interface LearnLink {
  title: string;
  /** https only. */
  url: string;
  description?: string;
}

/** One-time beginner tips. The web app shows each until the person dismisses it or uses the feature. */
export const HINT_IDS = ["welcome", "think-harder", "compare", "workspaces", "templates", "attach", "refine"] as const;
export type HintId = (typeof HINT_IDS)[number];

export interface UserProfile {
  email: string;
  status: ProfileStatus;
  createdAt: string;
  lastSeenAt?: string;
  /** Beginner tips already seen or dismissed. */
  hints?: HintId[];
}

export interface ModelEntry {
  modelId: string;
  label: string;
  provider: string;
  description: string;
  enabled: boolean;
  capabilities: { vision: boolean; documents: boolean; reasoning: boolean; temperature: boolean; promptCache: boolean };
  /** Admin-set default; only ever sent when capabilities.temperature is true. */
  defaultTemperature?: number;
  contextWindow: number;
  maxOutputTokens: number;
  sortOrder: number;
}

export interface Template {
  templateId: string;
  title: string;
  description: string;
  category: string;
  systemPrompt: string;
  starterPrompt: string;
  enabled: boolean;
  sortOrder: number;
}

export interface Attachment {
  key: string;
  name: string;
  contentType: string;
  size: number;
}

export interface Citation {
  index: number;
  title: string;
  snippet: string;
  workspaceId?: string;
  documentId?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}

export type SessionMode = "chat" | "compare";

export interface Session {
  sessionId: string;
  title: string;
  mode: SessionMode;
  modelId: string;
  modelIds?: string[];
  workspaceId?: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  messageId: string;
  sessionId: string;
  role: "user" | "assistant";
  /** Client-sent 0-based turn number (compare sessions pair answers by it). */
  turn?: number;
  content: string;
  /** Display-only: the stored long message could not be fetched, `content` is a short note. */
  contentUnavailable?: boolean;
  /** Set when the content lives in S3 (over 300 KB); `content` is then empty until resolved. */
  contentKey?: string;
  attachments?: Attachment[];
  modelId?: string;
  citations?: Citation[];
  usage?: Usage;
  latencyMs?: number;
  stopReason?: string;
  /** Summarized thinking text and how long the model thought before answering. */
  reasoning?: string;
  thinkingMs?: number;
  notices?: { code: string; message: string }[];
  /** Set on a failed turn: the assistant message carries no content, only the error. */
  error?: { code: string; message: string };
  feedback?: { rating: "up" | "down"; comment?: string; at: string };
  createdAt: string;
}

export interface Workspace {
  workspaceId: string;
  name: string;
  description: string;
  visibility: "personal" | "shared";
  ownerSub: string;
  ownerEmail: string;
  createdAt: string;
  docCount: number;
}

export type DocStatus = "uploading" | "uploaded" | "indexing" | "ready" | "failed";

export interface WorkspaceDoc {
  docId: string;
  workspaceId: string;
  name: string;
  contentType: string;
  size: number;
  s3Key: string;
  status: DocStatus;
  error?: string;
  ingestionJobId?: string;
  createdAt: string;
}
