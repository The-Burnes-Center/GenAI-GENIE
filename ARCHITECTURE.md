# Genie v2 architecture

Genie is a private, multi-model AI workspace on AWS: chat with current Bedrock models, attach files, compare models side by side, run prompt templates, and ask questions over document workspaces. Admins run the system from an in-app console.

This replaces the v1 fork of aws-genai-llm-chatbot (AppSync, SNS/SQS, LangChain 0.1, Cloudscape, VPC + NAT). Goals: near-zero idle cost, far less code, current models, a clean UI, role-based administration.

## Repo layout

```
infra/     CDK app (TypeScript). Entry infra/bin/genie.ts, one stack.
backend/   Lambda source (TypeScript, Node.js 22, AWS SDK v3), bundled by NodejsFunction/esbuild.
  src/api/     buffered REST router (one Lambda)
  src/chat/    streaming chat handler (one Lambda, response streaming)
  src/lib/     shared: auth, db, models, settings, bedrock, knowledge base, validation
web/       React app (Vite)
design/    DESIGN.md + static prototype
scripts/   operator scripts (create-user.sh)
```

## AWS resources (one stack, `${prefix}GenieStack`)

| Resource | Notes |
|---|---|
| Cognito user pool | Email sign-in, self sign-up off, feature plan ESSENTIALS, group `admin`. App client: no secret, SRP + USER_PASSWORD auth. |
| DynamoDB table `Table` | Single table, PK/SK strings, pay per request, PITR on. GSI not needed at v2 scale. |
| S3 `UploadsBucket` | Chat attachments (`attachments/{sub}/{uuid}/{name}`) and workspace docs (`workspaces/{wsId}/{docId}/{name}` + `.metadata.json` sidecar). Private, SSE-S3, CORS for presigned PUT from the site origin. Lifecycle: attachments expire after 30 days. |
| S3 Vectors bucket + index | 1024 dims, cosine, float32. Non-filterable metadata keys: `AMAZON_BEDROCK_TEXT`, `AMAZON_BEDROCK_METADATA`. |
| Bedrock Knowledge Base | Vector type, embeddings `amazon.titan-embed-text-v2:0` (1024), storage S3_VECTORS. One S3 data source over `workspaces/` with fixed-size chunking (800 tokens, 15% overlap). Workspaces are separated by the `workspaceId` metadata filter. |
| Lambda `ApiFunction` | Node 22, arm64, 1024 MB, 29 s. Function URL, auth NONE (JWT verified in code), buffered. |
| Lambda `ChatFunction` | Node 22, arm64, 1024 MB, 15 min. Function URL, auth NONE, invoke mode RESPONSE_STREAM. |
| S3 `WebsiteBucket` + CloudFront | Default behavior: website (OAC). `/api/chat*` → ChatFunction URL origin. `/api/*` → ApiFunction URL origin. Both API behaviors: caching disabled, all methods, origin request policy ALL_VIEWER_EXCEPT_HOST_HEADER. SPA fallback (403/404 → /index.html) only for the website origin. |
| `config.json` | Written to the website bucket at deploy: `{ region, userPoolId, userPoolClientId, passkeys: true, emailOtp: bool, signupEnabled: true }`. |
| Lambda `PreSignUpFunction` / `PostConfirmationFunction` | Cognito triggers (Node 22, arm64). Read settings / write profile in the table. Their IAM for Cognito uses a wildcard user pool ARN in this account/region to avoid a pool ↔ trigger cycle. |
| SSM parameter `/{prefix}/genie/auth` | `{ userPoolId, userPoolClientId }` JSON, read by the API and chat Lambdas at cold start. |
| Optional config | `infra/config.json`: `domainName` + `certificateArn` (us-east-1 ACM) for a custom domain and passkey RP ID; `sesFromEmail` + `sesIdentityArn` to enable email one-time codes. |

No VPC, NAT, AppSync, SNS, SQS, identity pool, or SageMaker. All resources carry tags Project=genai-genie, Environment (config, default dev), ManagedBy=cdk, Owner=burnes-center.

IAM: Lambdas get least privilege: table read/write, uploads bucket read/write/delete + presign, `bedrock:Converse*`/`InvokeModel*` on foundation models and inference profiles, `bedrock:ListFoundationModels`, `bedrock:ListInferenceProfiles`, KB `Retrieve`, `StartIngestionJob`, `GetIngestionJob`, `ListIngestionJobs`, Cognito admin user operations on the pool (API Lambda only).

## Sign-in, sign-up and roles

Verified against Cognito docs on 2026-11-17: passkeys need the ESSENTIALS plan and choice-based auth (`USER_AUTH`), and `WEB_AUTHN` must be paired with at least one other first factor. The relying-party ID can be any domain not on the public suffix list, so the CloudFront hostname (or a custom domain) works without Cognito managed login. Email one-time codes require the pool to send mail through Amazon SES (DEVELOPER email config).

- **Pool sign-in policy:** `AllowedFirstAuthFactors = [PASSWORD, WEB_AUTHN]`, plus `EMAIL_OTP` only when `infra/config.json` sets `sesFromEmail` + `sesIdentityArn`. `WebAuthnRelyingPartyID` = custom domain if configured, else the CloudFront domain. `WebAuthnUserVerification = preferred`. MFA off (passwordless and MFA cannot be combined per user; passkeys with user verification are the strong factor). App client allows `ALLOW_USER_AUTH`, `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`. Changing the RP ID later invalidates passkeys, so set the custom domain before real users enroll.
- **Sign-in UX (web):** one email field, then Continue. Amplify `signIn({ username, options: { authFlowType: "USER_AUTH" } })` returns the available challenges; offer passkey first when available (`preferredChallenge: "WEB_AUTHN"`), otherwise password, otherwise email code. Supports NEW_PASSWORD_REQUIRED for invited users and forgot-password.
- **Passkey enrollment:** after a successful non-passkey sign-in, a one-time, dismissible prompt offers "Sign in faster with a passkey" (`associateWebAuthnCredential()`). An Account page lists and removes passkeys (`listWebAuthnCredentials`, `deleteWebAuthnCredential`) and changes the password.
- **Self sign-up:** enabled on the pool, governed by admin settings: `signupMode` (`off` | `open`), `allowedEmailDomains` (empty = any), `requireApproval` (bool). A **pre sign-up Lambda trigger** reads settings from the table and rejects with a friendly message when sign-up is off or the domain is not allowed. Users confirm their email with a code (default Cognito email is fine for this; ~50/day cap without SES). A **post confirmation trigger** writes the user profile with status `pending` (if `requireApproval`) or `active`.
- **User profile item** `USER#{sub}` / `PROFILE`: email, status (`active` | `pending` | `suspended`), createdAt, lastSeenAt. A profile with no stored status counts as `active` for admins and when approval is off, and as `pending` otherwise (accounts created outside the app, for example in the Cognito console). API middleware loads it (cache 60 s in memory); `pending` gets 403 `PENDING_APPROVAL` (the UI shows a "waiting for approval" screen), `suspended` gets 403 `SUSPENDED`.
- Every API call sends `Authorization: Bearer <ID token>`. Lambdas verify with `aws-jwt-verify` (tokenUse `id`, clientId). The user is `{ sub, email, isAdmin, status }`, where `isAdmin = cognito:groups includes "admin"`.
- Roles: `user` (default) and `admin` (Cognito group). Admin routes return 403 for non-admins. The UI hides admin navigation for non-admins, but the server is the authority.
- Disabled users are rejected by Cognito at sign-in. Admins cannot remove their own admin role or disable themselves.
- **Cycle note for infra:** user pool needs the CloudFront domain (RP ID); CloudFront needs the Function URLs; the Lambdas must not reference the pool directly. Lambdas read `userPoolId` / `userPoolClientId` from an SSM parameter (`/{prefix}/genie/auth`) at cold start, with the parameter name passed as a plain string env var and IAM scoped to that name.

## Data model (single table)

| Item | PK | SK | Attributes |
|---|---|---|---|
| Session | `USER#{sub}` | `SESSION#{sessionId}` | title, mode (`chat`/`compare`), modelId, modelIds (compare), workspaceId?, templateId?, createdAt, updatedAt, messageCount |
| Message | `SESSION#{sessionId}` | `MSG#{createdAt}#{messageId}` | role (`user`/`assistant`), content, attachments `[{key,name,contentType,size}]`, modelId, citations, usage `{inputTokens,outputTokens}`, latencyMs, stopReason, feedback `{rating,comment,at}` |
| Settings | `CONFIG` | `SETTINGS` | appName, welcomeTitle, welcomeMessage, disclaimer, defaultModelId, titleModelId (default Claude Haiku 5.5), dailyMessageLimit (default 100; 0 = unlimited), maxCompareModels (default 3), signupMode, allowedEmailDomains, requireApproval, retrievalTopK (default 15, max 100; a stored 8 is migrated to 15 on read), timezone (default America/New_York), templateCategories, assistantInstructions (base system prompt for every chat, default in `defaults.ts`), dataRules (string[], "what not to share" rules), learnLinks (`{title, url, description?}[]`, https only), helpContact (email or https URL, empty hides it) |
| User profile | `USER#{sub}` | `PROFILE` | email, status, createdAt, lastSeenAt, hints (beginner tips seen or dismissed, a list of `HINT_IDS`) |
| Model | `CONFIG` | `MODEL#{modelId}` | modelId (Bedrock model or inference profile id), label, provider, description, enabled, capabilities `{vision, documents, reasoning, temperature, promptCache}`, contextWindow, maxOutputTokens, sortOrder |
| Template | `CONFIG` | `TEMPLATE#{templateId}` | title, description, category, systemPrompt, starterPrompt, enabled, sortOrder |
| Workspace | `WORKSPACES` | `WS#{workspaceId}` | name, description, visibility (`personal`/`shared`), ownerSub, ownerEmail, createdAt, docCount |
| Document | `WS#{workspaceId}` | `DOC#{docId}` | name, contentType, size, s3Key, status (`uploading`/`uploaded`/`indexing`/`ready`/`failed`), error?, ingestionJobId?, createdAt |
| Usage | `USAGE#{yyyy-mm-dd}` (local date in settings timezone) | `MODEL#{modelId}#USER#{sub}` | requests, inputTokens, outputTokens (atomic ADD on completion), email |
| Daily counter | `USAGE#{yyyy-mm-dd}` | `COUNT#USER#{sub}` | requests: reserved with a conditional ADD before the model is called (so parallel requests cannot pass the limit) and refunded if the turn fails |
| Pending sign-up index | `PENDING` | `{sub}` | email, at (powers the admin approval badge) |
| Pending upload | `UPLOAD#{sub}` | `{uploadId}` | key (`staging/{sub}/{uploadId}`), workspaceId, fileName, contentType, size, expiresAt (TTL 1 day). Workspace uploads are presigned to `staging/` (1-day lifecycle); registration claims this item, copies the object to `workspaces/{ws}/{docId}/source.{ext}` if its ETag is unchanged, and writes the sidecar itself. Users never write under `workspaces/`. |
| Deleted-user tombstone | `USER#{sub}` | `PROFILE` | status `deleted`, expiresAt (TTL; at least a day and twice the token validity), so a deleted user's still-valid ID token is refused |
| Feedback index | `FEEDBACK` | `{at}#{messageId}` | sessionId, messageId, rating, comment, modelId, userEmail, promptExcerpt, responseExcerpt |
| Audit | `AUDIT` | `{at}#{uuid}` | actorSub, actorEmail, action, target, details |

Settings, models and templates are seeded on first read from `backend/src/lib/defaults.ts` when absent. A settings item stored before a field existed is merged with the defaults on read, so the new fields need no migration.

### Default model catalog (all verified callable in us-east-1 on 2026-11-17)

| modelId | label | provider | vision | documents | reasoning | temperature | promptCache | contextWindow | maxOutputTokens |
|---|---|---|---|---|---|---|---|---|---|
| `us.anthropic.claude-haiku-5-5` | Claude Haiku 5.5 (default, and the title and rewrite model) | Anthropic | yes | yes | yes | **no** | yes | 1,000,000 | 128,000 |
| `us.anthropic.claude-sonnet-5-5` | Claude Sonnet 5.5 | Anthropic | yes | yes | yes | **no** | yes | 1,000,000 | 128,000 |
| `us.anthropic.claude-opus-5-5` | Claude Opus 5.5 | Anthropic | yes | yes | yes | **no** | yes | 1,000,000 | 128,000 |
| `global.openai.gpt-6.2-sol` | GPT-6.2 Sol | OpenAI | no | **no** | no | **no** | no | 200,000 | 32,000 |
| `openai.gpt-oss-120b-1:0` | gpt-oss 120B | OpenAI | no | no | no | yes | no | 128,000 | 32,000 |
| `us.amazon.nova-pro-v1:0` | Nova Pro | Amazon | yes | yes | no | yes | yes | 300,000 | 10,000 |
| `us.amazon.nova-2-lite-v1:0` | Nova 2 Lite | Amazon | yes | yes | no | yes | yes | 300,000 | 32,000 |
| `mistral.mistral-large-3-675b-instruct` | Mistral Large 3 | Mistral AI | no | **no** | no | yes | no | 128,000 | 32,000 |
| `deepseek.v3.2` | DeepSeek V3.2 | DeepSeek | no | **no** | no | yes | no | 128,000 | 32,000 |
| `qwen.qwen3-next-80b-a3b` | Qwen3 Next 80B | Qwen | no | no | no | yes | no | 128,000 | 32,000 |
| `global.xai.grok-4.7` | Grok 4.7 | xAI | no | **no** | no | **no** | no | 128,000 | 32,000 |

Bold = verified live on 2026-11-17 (Converse returned "temperature is deprecated" / "doesn't support documents"; Nova 2 Lite read a PDF). Claude limits are from Anthropic's model table. Non-Claude context windows are conservative estimates: the server must not trust them blindly (see "Limits and long-running work"). Admins can edit every field. Some models reject small `maxTokens` (GPT/Grok need >= 16); floor 64.

## Chat streaming contract

`POST /api/chat` (ChatFunction). Body:

```json
{
  "sessionId": "optional, omitted for a new chat",
  "modelId": "us.anthropic.claude-sonnet-5-5",
  "prompt": "text",
  "attachments": [{ "key": "attachments/...", "name": "a.pdf", "contentType": "application/pdf", "size": 1234 }],
  "workspaceId": "optional",
  "templateId": "optional",
  "mode": "chat | compare",
  "compareModelIds": ["only for mode=compare: the full set in this compare session"],
  "settings": { "thinking": "standard | deep" }
}
```

There is no temperature or max-length control for users: most current models reject temperature, and modern chat apps do not expose it. `thinking: "deep"` is only offered for models with `capabilities.reasoning`; for Claude it maps to `additionalModelRequestFields: { thinking: { type: "adaptive", display: "summarized" }, output_config: { effort: "high" } }` (`standard` = effort `low`, same thinking block; verified accepted on Opus 5.5). `temperature` is only ever sent when the model has `capabilities.temperature` and an admin set a default; never for Claude 5.x.

Response: `Content-Type: application/x-ndjson`, one JSON object per line:

```
{"type":"session","sessionId":"...","messageId":"...","title":"..."}
{"type":"ping"}                       every 10 s until the first token, and during long tool/retrieval gaps
{"type":"notice","code":"HISTORY_TRIMMED|ATTACHMENT_AS_TEXT","message":"human readable"}
{"type":"citations","items":[{"index":1,"title":"policy.pdf","snippet":"...","workspaceId":"...","documentId":"..."}]}
{"type":"reasoning","text":"summarized thinking, streamed"}
{"type":"delta","text":"Hel"}
{"type":"done","usage":{"inputTokens":120,"outputTokens":340,"cacheReadTokens":0},"latencyMs":2100,"stopReason":"end_turn"}
{"type":"title","sessionId":"...","title":"Generated title"}   new sessions only, after done
{"type":"error","code":"MODEL_DISABLED|LIMIT_REACHED|BAD_REQUEST|CONTEXT_TOO_LONG|BEDROCK_THROTTLED|BEDROCK_ERROR|REFUSED","message":"human readable"}
```

Server steps: verify JWT + profile status → validate body (zod) → check model enabled + daily limit → create or load session (must belong to user) → emit `session` immediately → load **all** prior messages (paginate the Query; for compare: only this modelId's assistant turns plus the user turns) → if workspaceId: KB `Retrieve` (top `retrievalTopK`, filter `workspaceId` equals) and add a grounded-answer system block with numbered sources, emit `citations` → build the system blocks in this order: `settings.assistantInstructions` (skipped when empty after trim), then the template's `systemPrompt`, then the sources block, then a `cachePoint` last when `capabilities.promptCache`. The same blocks apply to normal chat, compare, retry and fork, because they all run through this path. Title generation and the rewrite helper never receive the assistant instructions. Build Converse messages: images become image blocks only for vision models; documents become document blocks for document-capable models, otherwise the server extracts text (PDF via `unpdf`, DOCX via `mammoth`, TXT/MD/CSV/HTML as text) and inlines it as a fenced, clearly labelled text block, emitting `notice ATTACHMENT_AS_TEXT`; spreadsheets on non-document models → `BAD_REQUEST` with a clear message → add `cachePoint` after the system prompt and after the last prior turn when `capabilities.promptCache` → `ConverseStream` with `maxTokens = model.maxOutputTokens` → stream `reasoning` + `delta` → persist user + assistant messages, update session, ADD usage → for a new session, generate a short title with `titleModelId` (max 12 words, no quotes) and emit `title`; fallback to the first 60 chars of the prompt.

Compare: the client sends one request per model with the same `sessionId` and `mode: "compare"`. The first request without a sessionId creates the session; the client then reuses it. In compare sessions **both** the user and assistant messages carry `modelId` and a `turn` number (0-based, sent by the client as `turn` in the request body); history for a model is the messages with that `modelId`. The UI shows each user turn once (dedupe by `turn`) with one answer per model.

Exact byte limits (decimal, enforced identically on client and server): images 3,750,000; attachment documents 4,500,000; workspace documents 50,000,000.

## Running cost

Genie has no always-on resources: no VPC, NAT gateway, OpenSearch, Kendra, Aurora, WAF or KMS key. Every resource bills per use (Lambda, DynamoDB on demand, S3, S3 Vectors, CloudFront `PriceClass_100`, Cognito Essentials), so an idle deployment costs cents a month. Nearly all spend is model calls, so the defaults are chosen for cost:

- **Default model Claude Haiku 5.5.** About $0.10 / $0.50 per million input / output tokens against $2 / $10 for Sonnet 5.5. In a side-by-side run on 2026-11-18 (plain-language rewrite, team email, meeting agenda) Haiku cost $0.0002 to $0.0004 per answer against $0.003 to $0.008 for Sonnet, answered faster, and matched it on quality. Sonnet and Opus stay in the picker; descriptions say which cost more.
- **Everyday effort `low`.** Standard chats send effort `low`; "Think harder" sends `high`.
- **Daily cap of 100 messages per person** by default (admins can change it; 0 = unlimited), plus 50 rewrites per person per day.
- **Prompt caching** on every Claude request (system blocks and prior turns), so long chats re-read history at the cached rate.
- **Titles and rewrites** run on the title model (Haiku 5.5).

Bedrock on-demand calls are not taggable, so model spend does not appear under the `Project` tag in Cost Explorer; the admin Usage page (tokens by model and person) is the per-deployment view.

## Limits and long-running work (do not regress)

v1 shipped with a 512-token reply cap, temperature 0.01, and a hardcoded 2024 model list. v2 rules:

- **Output length:** always request the model's full `maxOutputTokens`. Never a small default.
- **Context:** send the whole conversation. Estimate tokens (chars / 3.5, plus 1,600 per image) and pre-trim only beyond 90% of `contextWindow - maxOutputTokens`. If Bedrock still rejects with a too-long error (`ValidationException` matching /too long|context length|maximum context|too many tokens/i), drop the oldest half of prior turns (never the current turn or attachments), retry, at most twice, and emit `notice HISTORY_TRIMMED`. If the current turn alone is too long, emit `CONTEXT_TOO_LONG` with advice.
- **Slow first token:** reasoning models can think for minutes. ChatFunction timeout 900 s; CloudFront origin read timeout 60 s and keepalive 60 s for the chat behavior; the handler writes `ping` lines every 10 s while waiting so neither CloudFront nor browsers time out. The client shows "Thinking" with elapsed time and a Stop button.
- **Throttling:** AWS SDK adaptive retry mode (max 4 attempts) for Bedrock; surface `BEDROCK_THROTTLED` with "busy, try again" copy if it still fails. Refusals (`stopReason` `guardrail_intervened`/content filtered) → `REFUSED`.
- **Item size:** DynamoDB items cap at 400 KB. Message content over 300 KB is stored in S3 (`messages/{sessionId}/{messageId}.txt`) with a pointer on the item.
- **Request size:** Function URL request bodies cap at 6 MB; files never travel in the chat request (S3 keys only). Prompt text cap 400,000 characters with a friendly error suggesting attaching a file instead.
- **Attachments per message:** up to 5 documents and 20 images (Converse limits); sizes as in `/api/uploads`.
- **Pagination everywhere:** sessions list, messages Query, admin users (Cognito `ListUsers` pagination token), usage scans, workspace documents.
- **History and titles in the sidebar:** newest 50 sessions with infinite scroll and server-side title search, not "5 recent".
- **Streaming response cap:** Lambda response streaming allows 20 MB per response, far above 128K tokens of text.
- **Settings field limits (admin PUT, enforced by zod):** `assistantInstructions` up to 4,000 characters; `dataRules` up to 10 items of 1 to 200 characters each (trimmed); `learnLinks` up to 8 items, each title 1 to 80 characters, url `https://` and up to 500 characters, optional description up to 200 characters; `helpContact` empty, an email address, or an `https://` URL, up to 200 characters.
- **Rewrite input:** `POST /api/assist/rewrite` takes 1 to 8,000 characters after trimming. The model's reply is capped at 1,500 output tokens and its rewritten text at 8,000 characters. Each person gets 50 rewrites per local day (`REWRITE_DAILY_LIMIT`), counted on `USAGE#{day}` / `ASSIST#USER#{sub}`, separate from the chat message limit; the 51st returns 429 `LIMIT_REACHED` before any model call. A rewrite that fails (busy, timeout, unusable reply) is refunded, so only useful ones count.

Compare: the client sends one request per model with the same `sessionId` and `mode: "compare"`. The first request without a sessionId creates the session; the client then reuses it.

## REST API (ApiFunction)

All JSON. Errors: `{ "error": { "code": "...", "message": "..." } }` with 400/401/403/404/409/500, plus 429 `LIMIT_REACHED` (a helper's daily cap), 502 `ASSIST_FAILED` (the rewrite helper's model reply was unusable or the model failed) and 503 `UNAVAILABLE` (busy or throttled, try again). Pagination: `?cursor=` → `{ items, nextCursor }`.

User routes:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/me` | `{ sub, email, isAdmin, hints, pendingCount? }`. `hints` is always present (`[]` when none) and is read straight from the table, not from the 60 s profile cache. |
| POST | `/api/me/hints` | `{ hint }` (one of `HINT_IDS`) → `{ hints }`. Idempotent: a tip already present is not added twice. Creates a missing profile as `active`. Never writes to a pending, suspended or deleted profile (403). |
| DELETE | `/api/me/hints` | Clears every tip (powers "Show beginner tips again") → `{ hints: [] }`. Never creates a profile. |
| POST | `/api/assist/rewrite` | `{ text }` → `{ text, changes }`. One non-streaming call on `titleModelId` (the default model when that one is missing or disabled), no assistant instructions, the request wrapped in `<request>` tags. Usage is recorded for the admin report but does not count toward the daily message limit; rewrites have their own cap of 50 a day (429 `LIMIT_REACHED`). `changes` holds up to 4 short strings. |
| GET | `/api/bootstrap` | `{ settings, models (enabled only), templates (enabled only), me }` |
| GET | `/api/sessions` | list own sessions, newest first, `?q=` title search |
| GET | `/api/sessions/{id}` | session + messages |
| PATCH | `/api/sessions/{id}` | `{ title }` |
| DELETE | `/api/sessions/{id}` | delete session + messages |
| DELETE | `/api/sessions` | delete all own sessions |
| POST | `/api/sessions/{id}/messages/{messageId}/feedback` | `{ rating: "up"|"down", comment? }` |
| POST | `/api/uploads` | `{ fileName, contentType, size, purpose: "attachment"|"workspace", workspaceId? }` → `{ key, uploadUrl, headers }` (presigned PUT, 5 min). Limits: images png/jpeg/gif/webp <= 3.75 MB; documents pdf/csv/doc/docx/xls/xlsx/html/txt/md <= 4.5 MB for attachments, <= 50 MB for workspaces. |
| GET | `/api/workspaces` | own personal + all shared |
| POST | `/api/workspaces` | `{ name, description, visibility }` (`shared` requires admin) |
| GET | `/api/workspaces/{id}` | workspace + documents (refreshes indexing status from the ingestion job) |
| PATCH | `/api/workspaces/{id}` | `{ name?, description? }` (owner or admin) |
| DELETE | `/api/workspaces/{id}` | owner or admin; deletes docs + reindexes |
| POST | `/api/workspaces/{id}/documents` | `{ key, name, contentType, size }` after upload; writes metadata sidecar, starts ingestion (if a job is running, leave status `uploaded` and retry on next status refresh) |
| DELETE | `/api/workspaces/{id}/documents/{docId}` | owner or admin; delete objects + reindex |

Admin routes (`admin` group only; every mutation writes an audit item):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/users` | users with email, Cognito status, enabled, isAdmin, profile status (`active`/`pending`/`suspended`), createdAt, lastSeenAt; `?status=pending` for the approval queue |
| POST | `/api/admin/users` | `{ email, role }` → Cognito invite email with temporary password |
| PATCH | `/api/admin/users/{username}` | `{ role?, enabled?, status? }` (`status: "active"` approves a pending sign-up) |
| POST | `/api/admin/users/{username}/reset-password` | Cognito admin reset (emails a code) |
| DELETE | `/api/admin/users/{username}` | delete user |
| GET | `/api/admin/models` | all catalog entries + `available`: Bedrock models/profiles not yet in the catalog |
| PUT | `/api/admin/models/{modelId}` | upsert catalog entry |
| DELETE | `/api/admin/models/{modelId}` | remove (cannot remove the default) |
| POST | `/api/admin/models/{modelId}/test` | short Converse call → `{ ok, latencyMs, error? }` |
| GET/PUT | `/api/admin/settings` | read/update settings |
| GET | `/api/admin/templates` | all templates |
| PUT | `/api/admin/templates/{id}` | upsert |
| DELETE | `/api/admin/templates/{id}` | delete |
| GET | `/api/admin/usage?from=&to=` | totals and rows by day, model, user |
| GET | `/api/admin/feedback?rating=down` | recent feedback |
| GET | `/api/admin/audit` | recent admin actions |

## Web app

React 19, TypeScript, Vite 8, Tailwind CSS 4 (tokens from design/DESIGN.md), React Aria Components for accessible primitives, React Router 7, TanStack Query 5, `aws-amplify` v6 auth only, react-markdown + remark-gfm with syntax highlighting. Loads `/config.json` at startup. Streams `/api/chat` with `fetch` + a ReadableStream NDJSON reader.

Quality bar: WCAG 2.2 AA (axe 0 violations, full keyboard path, visible focus, reduced motion), light and dark themes, works at 360 px wide.

## Operations

- `scripts/create-user.sh <email> [--admin] [stack]` creates a user with a permanent password; `--admin` adds the `admin` group. The first admin is created this way.
- Deploy: `npm ci && npx cdk deploy` from `infra/` (builds `web/` and bundles `backend/`).
- Teardown: `npx cdk destroy`. Idle cost is S3, DynamoDB, CloudFront and S3 Vectors storage: cents per month at demo scale.

## Addendum: decisions for design contract gaps (2026-11-17)

Resolves design/DESIGN.md section 17. These are part of the contract.

1. **Daily usage:** `/api/bootstrap` includes `usage: { used, limit, resetsAt }` (limit 0 = unlimited). The day boundary is midnight in settings `timezone` (default `America/New_York`); usage items are keyed by that local date. `LIMIT_REACHED` errors carry `resetsAt`.
2. **Public config:** unauthenticated `GET /api/public-config` → `{ appName, signupMode, allowedEmailDomains, emailOtp }`. Cache-Control 60 s. No other data.
3. **Declining a sign-up:** `DELETE /api/admin/users/{username}` on a pending user deletes the Cognito user and profile (UI confirms first). No `declined` status.
4. **Approval notice:** no email in v2 (no SES sender yet). UI copy: "Approved. They can sign in now."
5. **Suspend is one control:** `PATCH status: "suspended"` sets the profile status **and** calls `AdminDisableUser`; `status: "active"` re-enables. The web maps Cognito's "User is disabled" sign-in error to the suspended screen. `enabled` is no longer a separate field in PATCH.
6. **Compare to chat:** `POST /api/sessions/{id}/fork` `{ modelId }` → creates a `chat` session for that model containing copies of that model's user + assistant messages; returns `{ sessionId }`.
7. **Persist stream extras:** assistant messages store `reasoning` (summary text), `thinkingMs`, `notices[]` (`{code,message}`), and, on failure, `error {code,message}`. On a Bedrock failure the user message **is** stored with an assistant message carrying `error`, so reloads show the failure and a Retry. Retry = the client re-sends the same prompt with `retryOfMessageId`; the server deletes that pair first. It accepts a failed reply or the latest reply in the session (in compare sessions, the latest reply of that model), and rejects anything older.
8. **Retry indexing:** `POST /api/workspaces/{id}/documents/{docId}/retry` re-starts ingestion for a `failed` or stuck `uploaded` document.
9. **Feedback triage:** feedback items gain `reviewed` (bool). `GET /api/admin/feedback?rating=&modelId=&reviewed=&cursor=`; `PATCH /api/admin/feedback/{id}` `{ reviewed }`.
10. **Template categories:** settings `templateCategories: string[]` (default: Writing, Summaries, Planning, Communication, Policy, Translation); the editor picks from the list; admins edit the list in settings.
11. **Admin users** show `lastSeenAt` labeled "Last active".
12. **Passkeys** are listed as Cognito returns them; no rename.
13. **Pending count:** `/api/me` and `/api/bootstrap.me` include `pendingCount` for admins.
14. **Compare:** 2 to `maxCompareModels` (default 3) enabled models; any enabled model may be used.

15. **Beginner features (2026-11-18):** the `hints` list and the rewrite helper are described in the REST table and chat section above. Decisions: hint writes are one conditional UpdateItem that refuses pending, suspended and deleted profiles (the write is refused even if the in-memory status check was stale); a failed condition on a hint that is already present is a success that returns the current list. The rewrite helper records usage (so admins see its cost) but never increments the daily message counter; it has its own daily cap so it cannot become an unmetered way to call a model, and throttling returns 503 `UNAVAILABLE` while a failed or unusable model reply returns 502 `ASSIST_FAILED`.

## Naming and tagging (enforced by tests)

Every AWS resource gets an explicit, human-readable name: `genie-{env}-{part}`, lowercase kebab-case, where `env` is `dev` or `prod`. No auto-generated names, no `GenieGenie...`.

| Resource | Name |
|---|---|
| CloudFormation stack | `genie-{env}` |
| Cognito user pool / app client / group | `genie-{env}-users` / `genie-{env}-web` / `admin` |
| DynamoDB table | `genie-{env}-data` |
| S3 uploads / website buckets | `genie-{env}-uploads-{accountId}` / `genie-{env}-web-{accountId}` (account id from `Aws.ACCOUNT_ID` at deploy, never hardcoded) |
| S3 Vectors bucket / index | `genie-{env}-vectors-{accountId}` / `genie-{env}-documents` |
| Bedrock knowledge base / data source / role | `genie-{env}-documents` / `genie-{env}-workspaces` / `genie-{env}-kb-role` |
| Lambda functions | `genie-{env}-api`, `genie-{env}-chat`, `genie-{env}-pre-signup`, `genie-{env}-post-confirmation` |
| Lambda roles | `genie-{env}-{function}-role` |
| Log groups | `/aws/lambda/genie-{env}-{function}`, created explicitly by the stack, 30-day retention, deleted with the stack |
| CloudFront distribution comment / function / OAC | `genie-{env}` / `genie-{env}-spa-rewrite` / `genie-{env}-web-oac` |
| Cache / origin request policies | `genie-{env}-api-no-cache`, `genie-{env}-api-forward` |
| SSM parameter | `/genie/{env}/auth` |

Config: `infra/config.json` has `environment` (`dev` default) instead of `prefix`; everything derives from it.

Tags on every taggable resource (AWS tag standard): `Project=genai-genie`, `Environment={env}`, `ManagedBy=cdk`, `Owner=burnes-center`. Resources whose CloudFormation type takes tags in a special shape (Cognito `UserPoolTags`, Bedrock `Tags` maps, S3 Vectors) get them explicitly. An infra unit test synthesizes the stack and fails if any taggable resource lacks the four tags or any named resource breaks the pattern.

Code naming: a small root package (`genie`) runs scripts across `@genie/web`, `@genie/backend` and `@genie/infra`; each package keeps its own lockfile (the CDK bundler reads `backend/package-lock.json`). React components PascalCase files; everything else kebab-case files; camelCase values, PascalCase types, UPPER_SNAKE_CASE constants, `use` hooks, `is/has/should/can` booleans.
