/**
 * The REST contract: the JSON each route actually sends, by name. Types only (no runtime code), so the web app's
 * `web/src/api/contract.ts` can import it and fail the build when its own copies drift. Handlers annotate their
 * bodies with these, so a handler and its documented shape cannot disagree.
 */
import type { ErrorCode } from "./http.js";
import type { Message, ModelEntry, ProfileStatus, Session, Settings, Template, Workspace, WorkspaceDoc } from "./types.js";

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

/** `?cursor=` pagination: pass `nextCursor` back until it is null. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface MeResponse {
  sub: string;
  email: string;
  isAdmin: boolean;
  /** Admins only: sign-ups waiting for approval. */
  pendingCount?: number;
}

export interface DailyUsage {
  used: number;
  /** 0 = unlimited */
  limit: number;
  resetsAt: string;
}

export interface BootstrapResponse {
  settings: Settings;
  models: ModelEntry[];
  templates: Template[];
  me: MeResponse;
  usage: DailyUsage;
}

export interface PublicConfigResponse {
  appName: string;
  signupMode: Settings["signupMode"];
  allowedEmailDomains: string[];
  emailOtp: boolean;
}

export type SessionListResponse = Page<Session>;

export interface SessionDetailResponse {
  session: Session;
  messages: Message[];
}

export interface SessionResponse {
  session: Session;
}

export interface DeleteAllSessionsResponse {
  deleted: number;
  remaining: number;
}

export interface ForkSessionResponse {
  sessionId: string;
}

export interface FeedbackResponse {
  feedback: NonNullable<Message["feedback"]>;
}

export interface UploadResponse {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

export type WorkspaceListResponse = Page<Workspace>;

export interface WorkspaceResponse {
  workspace: Workspace;
}

export interface WorkspaceDetailResponse {
  workspace: Workspace;
  documents: WorkspaceDoc[];
}

export interface DocumentResponse {
  document: WorkspaceDoc;
}

export interface UserSummary {
  username: string;
  sub: string;
  email: string;
  cognitoStatus: string;
  profileStatus: ProfileStatus;
  enabled: boolean;
  isAdmin: boolean;
  createdAt?: string;
  lastModified?: string;
  lastSeenAt?: string;
}

export type AdminUserListResponse = Page<UserSummary>;

export interface InviteUserResponse {
  user: UserSummary;
}

export interface UpdateUserResponse {
  updated: true;
}

export interface ResetPasswordResponse {
  reset: true;
}

/** A Bedrock model or inference profile that could be added to the catalog. */
export interface AvailableModel {
  modelId: string;
  label: string;
  provider: string;
  kind: "model" | "profile";
}

export interface AdminModelsResponse {
  items: ModelEntry[];
  available: AvailableModel[];
}

export interface ModelResponse {
  model: ModelEntry;
}

export interface ModelTestResponse {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface AdminSettingsResponse {
  settings: Settings;
  /** Field name to explanatory text, shown beside the form. */
  help: Record<string, string>;
}

export interface SettingsResponse {
  settings: Settings;
}

export interface TemplateListResponse {
  templates: Template[];
}

export interface TemplateResponse {
  template: Template;
}

export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export interface UsageReportResponse {
  from: string;
  to: string;
  totals: UsageTotals & { key: string };
  byDay: (UsageTotals & { day: string })[];
  byModel: (UsageTotals & { modelId: string })[];
  byUser: (UsageTotals & { sub: string; email: string })[];
}

export interface FeedbackRecord {
  /** The index item's sort key (`{at}#{messageId}`); pass it back, URL-encoded, to review the item. */
  id: string;
  /** When the rating was given (the first part of `id`). */
  at: string;
  sessionId: string;
  messageId: string;
  rating: "up" | "down";
  /** Empty when the user left none. */
  comment: string;
  modelId: string;
  reviewed: boolean;
  userEmail: string;
  promptExcerpt: string;
  responseExcerpt: string;
}

export type FeedbackListResponse = Page<FeedbackRecord>;

export interface ReviewFeedbackResponse {
  id: string;
  reviewed: boolean;
}

export interface AuditRecord {
  /** The audit item's sort key (`{at}#{uuid}`), unique per entry. */
  id: string;
  at: string;
  actorSub: string;
  actorEmail: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
}

export type AuditListResponse = Page<AuditRecord>;
