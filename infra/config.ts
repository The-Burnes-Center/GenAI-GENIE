import * as fs from "node:fs";
import * as path from "node:path";

export type Environment = "dev" | "prod";

export interface GenieConfig {
  environment: Environment;
  /** Optional custom domain (also becomes the passkey relying party ID). */
  domainName?: string;
  /** ACM certificate ARN in us-east-1, required with domainName. */
  certificateArn?: string;
  /** Both required to enable email one-time codes (Cognito must send through SES). */
  sesFromEmail?: string;
  sesIdentityArn?: string;
  /**
   * Reserved concurrency per function. Defaults: chat 50, API 100. Set `null` to leave a function unreserved.
   * AWS keeps 100 executions unreserved, so an account with a low quota (e.g. 10) must lower these or use null.
   */
  chatReservedConcurrency?: number | null;
  apiReservedConcurrency?: number | null;
}

export const DEFAULT_CHAT_CONCURRENCY = 50;
export const DEFAULT_API_CONCURRENCY = 100;

const DEFAULTS: GenieConfig = { environment: "dev" };

/** Every physical name is `genie-{env}-{part}`, lowercase kebab-case. */
export const resourceName = (env: Environment, part: string): string => `genie-${env}-${part}`;
export const stackName = (env: Environment): string => `genie-${env}`;

/** Reads optional, gitignored infra/config.json and validates it. */
export function loadConfig(file = path.join(__dirname, "config.json")): GenieConfig {
  if (!fs.existsSync(file)) return DEFAULTS;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<GenieConfig>;
  const config = { ...DEFAULTS, ...raw };
  if (config.environment !== "dev" && config.environment !== "prod") {
    throw new Error('infra/config.json: environment must be "dev" or "prod"');
  }
  if (Boolean(config.domainName) !== Boolean(config.certificateArn)) {
    throw new Error("infra/config.json: domainName and certificateArn must be set together");
  }
  if (Boolean(config.sesFromEmail) !== Boolean(config.sesIdentityArn)) {
    throw new Error("infra/config.json: sesFromEmail and sesIdentityArn must be set together");
  }
  for (const key of ["chatReservedConcurrency", "apiReservedConcurrency"] as const) {
    const v = config[key];
    if (v !== undefined && v !== null && (!Number.isInteger(v) || v < 1)) {
      throw new Error(`infra/config.json: ${key} must be a positive integer, or null to disable reservation`);
    }
  }
  return config;
}

/** undefined (key omitted) means the default; null means no reservation. */
export function reservedConcurrency(value: number | null | undefined, fallback: number): number | undefined {
  if (value === null) return undefined;
  return value ?? fallback;
}

export const emailOtpEnabled = (c: GenieConfig) => Boolean(c.sesFromEmail && c.sesIdentityArn);
