import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

export interface RuntimeConfig {
  tableName: string;
  uploadsBucket: string;
  authParameterName: string;
  knowledgeBaseId: string;
  dataSourceId: string;
  allowedOrigin: string;
  emailOtp: boolean;
}

export interface AuthParams {
  userPoolId: string;
  userPoolClientId: string;
}

let authPromise: Promise<AuthParams> | undefined;

/** Environment variables the API and chat functions need. Cognito triggers only get TABLE_NAME. */
export const FULL_CONFIG_ENV = ["TABLE_NAME", "UPLOADS_BUCKET", "AUTH_PARAMETER_NAME", "KNOWLEDGE_BASE_ID", "DATA_SOURCE_ID"] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/**
 * Each value is read from the environment when first used, so a function only needs the
 * variables its code path touches (the sign-up triggers only have TABLE_NAME).
 * API and chat call `assertFullConfig()` at cold start to fail fast on incomplete wiring.
 */
const config: RuntimeConfig = {
  get tableName() { return required("TABLE_NAME"); },
  get uploadsBucket() { return required("UPLOADS_BUCKET"); },
  get authParameterName() { return required("AUTH_PARAMETER_NAME"); },
  get knowledgeBaseId() { return required("KNOWLEDGE_BASE_ID"); },
  get dataSourceId() { return required("DATA_SOURCE_ID"); },
  get allowedOrigin() { return process.env.ALLOWED_ORIGIN ?? "*"; },
  get emailOtp() { return process.env.EMAIL_OTP === "true"; },
};

export function getConfig(): RuntimeConfig {
  return config;
}

/** Throws listing every missing variable. Call once at cold start in the API and chat handlers. */
export function assertFullConfig(): void {
  const missing = FULL_CONFIG_ENV.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

export function parseAuthParams(raw: string | undefined): AuthParams {
  const parsed = JSON.parse(raw ?? "") as Partial<AuthParams>;
  if (!parsed.userPoolId || !parsed.userPoolClientId) throw new Error("Auth parameter is missing userPoolId or userPoolClientId");
  return { userPoolId: parsed.userPoolId, userPoolClientId: parsed.userPoolClientId };
}

/**
 * The pool ids come from SSM, not the environment, so the Lambdas do not
 * depend on the user pool (which depends on the CloudFront domain). Read once per cold start.
 */
export function getAuthParams(): Promise<AuthParams> {
  authPromise ??= new SSMClient({})
    .send(new GetParameterCommand({ Name: getConfig().authParameterName }))
    .then((out) => parseAuthParams(out.Parameter?.Value))
    .catch((err) => {
      authPromise = undefined; // allow a retry on the next invocation
      throw err;
    });
  return authPromise;
}
