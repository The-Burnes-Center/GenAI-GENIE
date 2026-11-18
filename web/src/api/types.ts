// The REST contract as the web app sees it. Every shape mirrors what the backend handlers actually send
// (backend/src/lib/api-types.ts, types.ts, schemas.ts, ndjson.ts), field names included. contract.ts fails the
// build when a type here drifts from its backend twin, so change both together.

export type ChatMode = 'chat' | 'compare'
export type Rating = 'up' | 'down'
export type WorkspaceVisibility = 'personal' | 'shared'
export type UserRole = 'user' | 'admin'
// "deleted" is a short-lived tombstone the API never lists; it is part of the type so the unions match.
export type ProfileStatus = 'active' | 'pending' | 'suspended' | 'deleted'
export type SignupMode = 'off' | 'open'
export type DocumentStatus = 'uploading' | 'uploaded' | 'indexing' | 'ready' | 'failed'
export type UploadPurpose = 'attachment' | 'workspace'

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'PENDING_APPROVAL'
  | 'SUSPENDED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LIMIT_REACHED'
  | 'UNAVAILABLE'
  | 'ASSIST_FAILED'
  | 'INTERNAL'

// What every failed REST call returns: { error: { code, message } } with the matching HTTP status.
export interface ErrorBody {
  error: { code: ErrorCode; message: string }
}

// GET /api/me, and `me` inside bootstrap.
export interface Me {
  sub: string
  email: string
  isAdmin: boolean
  // Admins only: sign-ups waiting for approval, shown as a badge in the console.
  pendingCount?: number
  // Beginner tips this person has already seen or dismissed.
  hints: HintId[]
}

// One-time beginner tips. Each shows until the person dismisses it or uses the feature.
export type HintId = 'welcome' | 'think-harder' | 'compare' | 'workspaces' | 'templates' | 'attach' | 'refine'

// POST and DELETE /api/me/hints.
export interface HintsResponse {
  hints: HintId[]
}

// POST /api/assist/rewrite: a clearer version of the person's request, and what was added, in plain words.
export interface RewriteResponse {
  text: string
  changes: string[]
}

// Unauthenticated GET /api/public-config. Drives the sign-in and sign-up screens.
export interface PublicConfig {
  appName: string
  signupMode: SignupMode
  allowedEmailDomains: string[]
  emailOtp: boolean
}

// Today's message usage for the signed-in user. limit 0 means unlimited.
export interface DailyUsage {
  used: number
  limit: number
  resetsAt: string
}

export interface Capabilities {
  vision: boolean
  documents: boolean
  reasoning: boolean
  temperature: boolean
  promptCache: boolean
}

export interface Settings {
  appName: string
  welcomeTitle: string
  welcomeMessage: string
  disclaimer: string
  defaultModelId: string
  // 0 = unlimited
  dailyMessageLimit: number
  maxCompareModels: number
  titleModelId: string
  signupMode: SignupMode
  // Empty = any domain.
  allowedEmailDomains: string[]
  requireApproval: boolean
  retrievalTopK: number
  // IANA zone for the daily usage boundary (midnight local time).
  timezone: string
  templateCategories: string[]
  // Base instructions sent to the model with every chat, before any template's own prompt.
  assistantInstructions: string
  // "What not to share" rules shown on the welcome card and the Learn page.
  dataRules: string[]
  // Training and help links on the Learn page.
  learnLinks: LearnLink[]
  // An email address or an https URL where staff can reach a person. Empty hides it.
  helpContact: string
}

export interface LearnLink {
  title: string
  // https only.
  url: string
  description?: string
}

export interface ModelConfig {
  modelId: string
  label: string
  provider: string
  description: string
  enabled: boolean
  capabilities: Capabilities
  // Admin-set default; only ever sent when capabilities.temperature is true.
  defaultTemperature?: number
  contextWindow: number
  maxOutputTokens: number
  sortOrder: number
}

// A Bedrock model or inference profile that is not in the catalog yet.
export interface AvailableModel {
  modelId: string
  label: string
  provider: string
  kind: 'model' | 'profile'
}

export interface AdminModelsResponse {
  items: ModelConfig[]
  available: AvailableModel[]
}

export interface ModelResponse {
  model: ModelConfig
}

export interface ModelTestResult {
  ok: boolean
  latencyMs: number
  error?: string
}

export interface Template {
  templateId: string
  title: string
  description: string
  category: string
  systemPrompt: string
  starterPrompt: string
  enabled: boolean
  sortOrder: number
}

export interface TemplateListResponse {
  templates: Template[]
}

export interface TemplateResponse {
  template: Template
}

export interface AdminSettingsResponse {
  settings: Settings
  // Field name to explanatory text, shown beside the form.
  help: Record<string, string>
}

export interface SettingsResponse {
  settings: Settings
}

export interface Bootstrap {
  settings: Settings
  models: ModelConfig[]
  templates: Template[]
  me: Me
  usage: DailyUsage
}

export interface AttachmentRef {
  key: string
  name: string
  contentType: string
  size: number
}

export interface Citation {
  index: number
  title: string
  snippet: string
  workspaceId?: string
  documentId?: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
}

export interface Feedback {
  rating: Rating
  comment?: string
  at: string
}

export interface Session {
  sessionId: string
  title: string
  mode: ChatMode
  modelId: string
  modelIds?: string[]
  workspaceId?: string
  templateId?: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface SessionDetail {
  session: Session
  messages: Message[]
}

export interface SessionResponse {
  session: Session
}

export interface DeleteAllSessionsResponse {
  deleted: number
  remaining: number
}

export interface ForkSessionResponse {
  sessionId: string
}

export interface FeedbackResponse {
  feedback: Feedback
}

export interface StreamNotice {
  code: string
  message: string
}

export interface StoredError {
  code: string
  message: string
}

export interface Message {
  messageId: string
  sessionId: string
  role: 'user' | 'assistant'
  // 0-based turn number the client sent. Compare sessions pair answers with prompts by it.
  turn?: number
  content: string
  // The stored long message could not be fetched, so content is a short note.
  contentUnavailable?: boolean
  // Set when the content lives in S3 (over 300 KB); content is then empty until resolved.
  contentKey?: string
  attachments?: AttachmentRef[]
  modelId?: string
  citations?: Citation[]
  usage?: Usage
  latencyMs?: number
  stopReason?: string
  // Assistant messages only: the summarized thinking and how long it ran.
  reasoning?: string
  thinkingMs?: number
  notices?: StreamNotice[]
  // Set on an assistant message when the Bedrock call failed. The user message is kept, so Retry can re-send it.
  error?: StoredError
  feedback?: Feedback
  createdAt: string
}

export interface Workspace {
  workspaceId: string
  name: string
  description: string
  visibility: WorkspaceVisibility
  ownerSub: string
  ownerEmail: string
  createdAt: string
  docCount: number
}

export interface WorkspaceResponse {
  workspace: Workspace
}

export interface WorkspaceDocument {
  docId: string
  workspaceId: string
  name: string
  contentType: string
  size: number
  s3Key: string
  status: DocumentStatus
  error?: string
  ingestionJobId?: string
  createdAt: string
}

export interface WorkspaceDetail {
  workspace: Workspace
  documents: WorkspaceDocument[]
}

export interface DocumentResponse {
  document: WorkspaceDocument
}

// cognitoStatus is the Cognito account state; profileStatus is our approval state.
export interface AdminUser {
  username: string
  sub: string
  email: string
  cognitoStatus: string
  profileStatus: ProfileStatus
  enabled: boolean
  isAdmin: boolean
  createdAt?: string
  lastModified?: string
  lastSeenAt?: string
}

export interface InviteUserResponse {
  user: AdminUser
}

export interface UpdateUserResponse {
  updated: true
}

export interface ResetPasswordResponse {
  reset: true
}

export interface UsageTotals {
  requests: number
  inputTokens: number
  outputTokens: number
}

// The report the server sends: one row type per grouping, each with its own key field.
export interface UsageReport {
  from: string
  to: string
  totals: UsageTotals & { key: string }
  byDay: (UsageTotals & { day: string })[]
  byModel: (UsageTotals & { modelId: string })[]
  byUser: (UsageTotals & { sub: string; email: string })[]
}

// Filters for GET /api/admin/feedback. Unset fields are not sent.
export interface FeedbackFilters {
  rating?: Rating
  modelId?: string
  reviewed?: boolean
}

export interface FeedbackRecord {
  // The index item's sort key: pass it back, URL-encoded, to review the item.
  id: string
  at: string
  sessionId: string
  messageId: string
  rating: Rating
  // Empty when the user left none.
  comment: string
  modelId: string
  reviewed: boolean
  userEmail: string
  promptExcerpt: string
  responseExcerpt: string
}

export interface ReviewFeedbackResponse {
  id: string
  reviewed: boolean
}

export interface AuditEntry {
  id: string
  at: string
  actorSub: string
  actorEmail: string
  action: string
  target: string
  details: Record<string, unknown>
}

export interface UploadTicket {
  key: string
  uploadUrl: string
  headers: Record<string, string>
}

// Request bodies. Each is exactly what the backend schema accepts, so optional here means the server
// has a default. Responses above are what comes back.

export interface RenameSessionInput {
  title: string
}

export interface HintInput {
  hint: HintId
}

export interface RewriteInput {
  text: string
}

export interface FeedbackInput {
  rating: Rating
  comment?: string
}

export interface ForkInput {
  modelId: string
}

export interface UploadRequest {
  fileName: string
  contentType: string
  size: number
  purpose: UploadPurpose
  workspaceId?: string
}

export interface WorkspaceInput {
  name: string
  description?: string
  visibility?: WorkspaceVisibility
}

export interface WorkspacePatch {
  name?: string
  description?: string
}

// contentType and size are ignored: the server records them when the upload is presigned.
export interface DocumentInput {
  key: string
  name: string
  contentType?: string
  size?: number
}

export interface InviteInput {
  email: string
  role?: UserRole
}

// Status "suspended" also disables the Cognito account, and "active" re-enables it (and approves a pending sign-up).
export interface UserPatch {
  role?: UserRole
  status?: 'active' | 'suspended'
}

export interface ModelEntryInput {
  label: string
  provider: string
  description?: string
  enabled?: boolean
  capabilities?: {
    vision: boolean
    documents: boolean
    reasoning?: boolean
    temperature?: boolean
    promptCache?: boolean
  }
  defaultTemperature?: number
  contextWindow: number
  maxOutputTokens: number
  sortOrder?: number
}

export interface TemplateInput {
  title: string
  description?: string
  category?: string
  systemPrompt?: string
  starterPrompt?: string
  enabled?: boolean
  sortOrder?: number
}

export interface ReviewFeedbackInput {
  reviewed: boolean
}
