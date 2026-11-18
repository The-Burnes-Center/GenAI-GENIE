// Compile-time contract check between this app and the backend. Nothing here runs and nothing imports this file,
// so no backend code reaches the bundle: it exists so `npm run typecheck` (tsconfig.contract.json) fails when a
// type in ./types or ../chat/types drifts from what the backend handlers send or accept.
//
// Each line asserts that a web type is identical to its backend twin: same fields, same optionality, same
// unions. If one fails, fix the side that is wrong (the backend implements ARCHITECTURE.md), never the check.
import type { ChatEvent as WebChatEvent, ChatErrorCode, ChatRequestBody, NoticeCode } from '../chat/types'
import type * as Web from './types'
import type * as Api from '../../../backend/src/lib/api-types'
import type { ChatEvent, ChatErrorCode as BackendChatErrorCode, NoticeCode as BackendNoticeCode } from '../../../backend/src/lib/ndjson'
import type * as Schemas from '../../../backend/src/lib/schemas'
import type * as Domain from '../../../backend/src/lib/types'

// Identical types, not just mutually assignable: assignability alone cannot see an extra optional field.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

// What a request schema accepts (before defaults are applied).
type Input<S extends { _zod: { input: unknown } }> = S['_zod']['input']

export type ContractChecks = [
  // Stored shapes
  Expect<Equals<Web.Session, Domain.Session>>,
  Expect<Equals<Web.Message, Domain.Message>>,
  Expect<Equals<Web.Workspace, Domain.Workspace>>,
  Expect<Equals<Web.WorkspaceDocument, Domain.WorkspaceDoc>>,
  Expect<Equals<Web.Template, Domain.Template>>,
  Expect<Equals<Web.ModelConfig, Domain.ModelEntry>>,
  Expect<Equals<Web.Settings, Domain.Settings>>,
  Expect<Equals<Web.Citation, Domain.Citation>>,
  Expect<Equals<Web.Usage, Domain.Usage>>,
  Expect<Equals<Web.AttachmentRef, Domain.Attachment>>,
  Expect<Equals<Web.Capabilities, Domain.ModelEntry['capabilities']>>,
  Expect<Equals<Web.Feedback, NonNullable<Domain.Message['feedback']>>>,
  Expect<Equals<Web.StreamNotice, NonNullable<Domain.Message['notices']>[number]>>,
  Expect<Equals<Web.StoredError, NonNullable<Domain.Message['error']>>>,
  Expect<Equals<Web.ProfileStatus, Domain.ProfileStatus>>,
  Expect<Equals<Web.SignupMode, Domain.Settings['signupMode']>>,
  Expect<Equals<Web.DocumentStatus, Domain.WorkspaceDoc['status']>>,
  Expect<Equals<Web.WorkspaceVisibility, Domain.Workspace['visibility']>>,
  Expect<Equals<Web.ChatMode, Domain.SessionMode>>,
  Expect<Equals<Web.Rating, NonNullable<Domain.Message['feedback']>['rating']>>,
  Expect<Equals<Web.HintId, Domain.HintId>>,
  Expect<Equals<Web.LearnLink, Domain.LearnLink>>,

  // Response bodies
  Expect<Equals<Web.Me, Api.MeResponse>>,
  Expect<Equals<Web.PublicConfig, Api.PublicConfigResponse>>,
  Expect<Equals<Web.HintsResponse, Api.HintsResponse>>,
  Expect<Equals<Web.RewriteResponse, Api.RewriteResponse>>,
  Expect<Equals<Web.DailyUsage, Api.DailyUsage>>,
  Expect<Equals<Web.Bootstrap, Api.BootstrapResponse>>,
  Expect<Equals<Web.Page<Web.Session>, Api.SessionListResponse>>,
  Expect<Equals<Web.SessionDetail, Api.SessionDetailResponse>>,
  Expect<Equals<Web.SessionResponse, Api.SessionResponse>>,
  Expect<Equals<Web.DeleteAllSessionsResponse, Api.DeleteAllSessionsResponse>>,
  Expect<Equals<Web.ForkSessionResponse, Api.ForkSessionResponse>>,
  Expect<Equals<Web.FeedbackResponse, Api.FeedbackResponse>>,
  Expect<Equals<Web.UploadTicket, Api.UploadResponse>>,
  Expect<Equals<Web.Page<Web.Workspace>, Api.WorkspaceListResponse>>,
  Expect<Equals<Web.WorkspaceResponse, Api.WorkspaceResponse>>,
  Expect<Equals<Web.WorkspaceDetail, Api.WorkspaceDetailResponse>>,
  Expect<Equals<Web.DocumentResponse, Api.DocumentResponse>>,
  Expect<Equals<Web.AdminUser, Api.UserSummary>>,
  Expect<Equals<Web.Page<Web.AdminUser>, Api.AdminUserListResponse>>,
  Expect<Equals<Web.InviteUserResponse, Api.InviteUserResponse>>,
  Expect<Equals<Web.UpdateUserResponse, Api.UpdateUserResponse>>,
  Expect<Equals<Web.ResetPasswordResponse, Api.ResetPasswordResponse>>,
  Expect<Equals<Web.AvailableModel, Api.AvailableModel>>,
  Expect<Equals<Web.AdminModelsResponse, Api.AdminModelsResponse>>,
  Expect<Equals<Web.ModelResponse, Api.ModelResponse>>,
  Expect<Equals<Web.ModelTestResult, Api.ModelTestResponse>>,
  Expect<Equals<Web.AdminSettingsResponse, Api.AdminSettingsResponse>>,
  Expect<Equals<Web.SettingsResponse, Api.SettingsResponse>>,
  Expect<Equals<Web.TemplateListResponse, Api.TemplateListResponse>>,
  Expect<Equals<Web.TemplateResponse, Api.TemplateResponse>>,
  Expect<Equals<Web.UsageTotals, Api.UsageTotals>>,
  Expect<Equals<Web.UsageReport, Api.UsageReportResponse>>,
  Expect<Equals<Web.FeedbackRecord, Api.FeedbackRecord>>,
  Expect<Equals<Web.Page<Web.FeedbackRecord>, Api.FeedbackListResponse>>,
  Expect<Equals<Web.ReviewFeedbackResponse, Api.ReviewFeedbackResponse>>,
  Expect<Equals<Web.AuditEntry, Api.AuditRecord>>,
  Expect<Equals<Web.Page<Web.AuditEntry>, Api.AuditListResponse>>,
  Expect<Equals<Web.ErrorBody, Api.ErrorBody>>,
  Expect<Equals<Web.ErrorCode, Api.ErrorBody['error']['code']>>,

  // Request bodies
  Expect<Equals<ChatRequestBody, Input<typeof Schemas.chatRequestSchema>>>,
  Expect<Equals<Web.RenameSessionInput, Input<typeof Schemas.renameSessionSchema>>>,
  Expect<Equals<Web.FeedbackInput, Input<typeof Schemas.feedbackSchema>>>,
  Expect<Equals<Web.UploadRequest, Input<typeof Schemas.uploadRequestSchema>>>,
  Expect<Equals<Web.WorkspaceInput, Input<typeof Schemas.createWorkspaceSchema>>>,
  Expect<Equals<Web.WorkspacePatch, Input<typeof Schemas.updateWorkspaceSchema>>>,
  Expect<Equals<Web.DocumentInput, Input<typeof Schemas.registerDocumentSchema>>>,
  Expect<Equals<Web.InviteInput, Input<typeof Schemas.inviteUserSchema>>>,
  Expect<Equals<Web.UserPatch, Input<typeof Schemas.updateUserSchema>>>,
  Expect<Equals<Web.ModelEntryInput, Input<typeof Schemas.modelEntrySchema>>>,
  Expect<Equals<Web.Settings, Input<typeof Schemas.settingsSchema>>>,
  Expect<Equals<Web.TemplateInput, Input<typeof Schemas.templateSchema>>>,
  Expect<Equals<Web.ForkInput, Input<typeof Schemas.forkSessionSchema>>>,
  Expect<Equals<Web.ReviewFeedbackInput, Input<typeof Schemas.reviewFeedbackSchema>>>,
  Expect<Equals<Web.HintInput, Input<typeof Schemas.hintSchema>>>,
  Expect<Equals<Web.RewriteInput, Input<typeof Schemas.rewriteRequestSchema>>>,

  // Chat stream (NDJSON lines)
  Expect<Equals<WebChatEvent, ChatEvent>>,
  Expect<Equals<NoticeCode, BackendNoticeCode>>,
  Expect<Equals<ChatErrorCode, BackendChatErrorCode>>,
]
