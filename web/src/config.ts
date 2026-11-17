import { Amplify } from 'aws-amplify'

// Written to the website bucket at deploy time (see ARCHITECTURE.md).
export interface GenieConfig {
  region: string
  userPoolId: string
  userPoolClientId: string
  // Email one-time codes need SES on the pool, so the deploy sets this only when it is available.
  emailOtp?: boolean
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const CONFIG_PATH = '/config.json'
let loadedConfig: GenieConfig | undefined

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(`config.json is missing "${field}".`)
  }
  return value
}

export function parseConfig(raw: unknown): GenieConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new ConfigError('config.json is not an object.')
  }
  const record = raw as Record<string, unknown>
  return {
    region: requireString(record.region, 'region'),
    userPoolId: requireString(record.userPoolId, 'userPoolId'),
    userPoolClientId: requireString(record.userPoolClientId, 'userPoolClientId'),
    emailOtp: record.emailOtp === true,
  }
}

export async function loadConfig(fetchFn: typeof fetch = fetch): Promise<GenieConfig> {
  const response = await fetchFn(CONFIG_PATH, { cache: 'no-store' })
  if (!response.ok) {
    throw new ConfigError(`config.json returned HTTP ${response.status}.`)
  }
  return parseConfig(await response.json())
}

export function configureAuth(config: GenieConfig): void {
  Amplify.configure(
    {
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.userPoolClientId,
          loginWith: { email: true },
        },
      },
    },
    { ssr: false },
  )
  loadedConfig = config
}

export function isEmailOtpEnabled(): boolean {
  return loadedConfig?.emailOtp === true
}
