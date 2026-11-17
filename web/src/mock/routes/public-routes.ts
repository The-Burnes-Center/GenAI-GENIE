import type { PublicConfig } from '../../api/types'
import { json, noContent } from '../http'
import { getStore } from '../store'
import type { MockRoute } from '../route-types'

// Same shape as infra/config.json written at deploy time. Cognito calls never happen in mock mode.
const MOCK_CONFIG = {
  region: 'us-east-1',
  userPoolId: 'mock',
  userPoolClientId: 'mock',
  emailOtp: true,
}

export const publicRoutes: MockRoute[] = [
  { method: 'GET', path: '/config.json', access: 'public', handle: () => json(MOCK_CONFIG) },
  {
    method: 'GET',
    path: '/api/public-config',
    access: 'public',
    handle: () => {
      const { appName, signupMode, allowedEmailDomains } = getStore().settings
      return json<PublicConfig>({ appName, signupMode, allowedEmailDomains, emailOtp: true })
    },
  },
  // Stands in for the presigned S3 PUT that /api/uploads hands out.
  { method: 'PUT', path: '/mock-s3/:key', access: 'public', handle: () => noContent() },
]
