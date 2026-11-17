# Operations

## What runs where

| Part | AWS resource (dev names) |
|---|---|
| Web app | S3 bucket `genie-dev-web-<account>` behind CloudFront |
| API | Lambda `genie-dev-api` (Function URL behind CloudFront `/api/*`) |
| Chat streaming | Lambda `genie-dev-chat` (response streaming, behind CloudFront `/api/chat*`) |
| Sign-in | Cognito user pool `genie-dev-users`, with triggers `genie-dev-pre-signup` and `genie-dev-post-confirmation` |
| Data | DynamoDB table `genie-dev-data` (on-demand, point-in-time recovery) |
| Files | S3 bucket `genie-dev-uploads-<account>` |
| Document search | Bedrock knowledge base `genie-dev-documents` on S3 Vectors `genie-dev-vectors-<account>` |
| Models | Amazon Bedrock (Converse API) |

There is no VPC, NAT gateway or always-on server.

## Cost

At rest, Genie costs cents a month: S3 storage, S3 Vectors storage, DynamoDB storage and CloudFront requests. Spend scales with use, mostly Bedrock model tokens. Watch it in **Admin > Usage** and in Cost Explorer by the `Project=genai-genie` tag. The daily message limit and reserved Lambda concurrency are the main cost guards.

## Logs

Each Lambda writes to `/aws/lambda/genie-{env}-{function}`, kept for 30 days. Logs are structured JSON with a request id. Prompts and answers are not logged.

## Limits worth knowing

| Limit | Value | Where it comes from |
|---|---|---|
| Reply length | The model's full maximum (128,000 tokens on Claude 5.5 models) | Model catalog |
| Conversation context | The whole conversation; the oldest turns are shortened only when a model reports the input is too long, and the person is told | Chat handler |
| Chat request duration | 15 minutes | Chat Lambda timeout |
| Silence on the connection | Keepalive every 10 seconds; CloudFront allows 60 | Chat handler, CloudFront |
| Attachments per message | 5 documents and 20 images, 20 MB in total per model request | Bedrock Converse |
| File size | Images 3.75 MB, attached documents 4.5 MB, workspace documents 50 MB | Bedrock and knowledge base limits |
| Prompt text | 400,000 characters | API validation |
| Session tokens | 15 minutes, refreshed automatically for 30 days | Cognito |

## Backups and recovery

DynamoDB point-in-time recovery is on. Chat attachments expire after 30 days. Deleting the stack deletes all data.

## Troubleshooting

| Symptom | Check |
|---|---|
| A model always fails | Admin > Models > Test. If it fails, confirm the model is available to the account in the Bedrock console. |
| A document stays "Indexing" or shows "Failed" | Open the workspace and choose Retry. Look at the knowledge base's ingestion jobs in the Bedrock console. |
| Sign-up emails stop arriving | Cognito's built-in sender allows about 50 emails a day. Configure SES (`sesFromEmail`, `sesIdentityArn`). |
| Deploy fails on reserved concurrency | Lower `chatReservedConcurrency` and `apiReservedConcurrency` in `infra/config.json`, or set them to `null`. |
