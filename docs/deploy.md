# Deploy Genie

Genie deploys as one CloudFormation stack, `genie-{env}`, with the AWS CDK. A first deploy takes about 15 minutes.

## What you need

- An AWS account and credentials with permission to deploy CloudFormation, Lambda, Cognito, DynamoDB, S3, S3 Vectors, Bedrock knowledge bases, CloudFront and IAM.
- Node.js 22 or newer (`.nvmrc` pins 22).
- The AWS CLI v2.
- Docker is **not** required. Lambdas are bundled with esbuild on your machine.

Genie runs in `us-east-1` by default. Other regions work if they offer Amazon Bedrock, the models you want, Bedrock knowledge bases and S3 Vectors.

## 1. Install

```bash
npm run install:all
```

## 2. Configure (optional)

Everything has a working default. To change anything, create `infra/config.json` (it is gitignored):

```json
{
  "environment": "dev",
  "domainName": "genie.example.org",
  "certificateArn": "arn:aws:acm:us-east-1:<account>:certificate/<id>",
  "sesFromEmail": "genie@example.org",
  "sesIdentityArn": "arn:aws:ses:us-east-1:<account>:identity/example.org",
  "chatReservedConcurrency": 50,
  "apiReservedConcurrency": 100
}
```

| Key | Default | What it does |
|---|---|---|
| `environment` | `dev` | `dev` or `prod`. Becomes the stack name `genie-{env}`, part of every resource name, and the `Environment` tag. |
| `domainName` + `certificateArn` | none | Serve Genie on your own domain. The ACM certificate must be in `us-east-1`. The domain also becomes the passkey relying-party ID. |
| `sesFromEmail` + `sesIdentityArn` | none | Send Cognito email through Amazon SES. Required for sign-in with emailed one-time codes; also removes Cognito's built-in limit of about 50 emails a day. |
| `chatReservedConcurrency` / `apiReservedConcurrency` | 50 / 100 | A ceiling on concurrent Lambda executions, as a cost and abuse guard. Set `null` on accounts with a low concurrency quota. |

**Set `domainName` before real users enroll passkeys.** Passkeys are bound to the domain. Changing it later means everyone registers their passkeys again.

## 3. Turn on model access

Genie calls models through Amazon Bedrock. In the Bedrock console, make sure the models in the default catalog are available to the account (most current models are enabled by default). Admins can turn any model off later from the Models page.

## 4. Deploy

```bash
npx cdk bootstrap aws://<account>/us-east-1   # once per account and region
npm run deploy
```

`npm run deploy` builds the web app, bundles the Lambdas and deploys. When it finishes it prints the outputs:

```
genie-dev.SiteUrl = https://dxxxxxxxxxxxx.cloudfront.net
genie-dev.UserPoolId = us-east-1_XXXXXXXXX
genie-dev.TableName = genie-dev-data
...
```

## 5. Create the first admin

Self sign-up is governed by admin settings, so the first admin is created from the command line:

```bash
./scripts/create-user.sh you@example.org --admin genie-dev
```

The script asks for a password (or reads `GENIE_USER_PASSWORD`), sets it as permanent, marks the account active and adds it to the `admin` group. Open the `SiteUrl`, sign in, and add a passkey from the prompt or the Account page.

## Update

Run `npm run deploy` again. Data in DynamoDB, S3 and the knowledge base is kept.

## Remove

```bash
cd infra && npx cdk destroy
```

This deletes every resource in the stack, including chats, uploads and workspace documents. It cannot be undone.

Two log groups belong to CDK's built-in helper functions rather than the stack, so delete them afterwards:

```bash
aws logs delete-log-group --log-group-name /aws/lambda/genie-dev-site-deploy
aws logs delete-log-group --log-group-name /aws/lambda/genie-dev-auto-delete-objects
```

## Run the web app locally

- `npm run dev:mock` runs the web app with a built-in mock backend. No AWS needed.
- `VITE_GENIE_URL=https://<SiteUrl> npm run dev` runs the web app against a deployed stack.
