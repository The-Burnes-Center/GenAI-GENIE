import { accountRoutes } from './account-routes'
import { assistRoutes } from './assist-routes'
import { adminCatalogRoutes } from './admin-catalog-routes'
import { adminOpsRoutes } from './admin-ops-routes'
import { adminUserRoutes } from './admin-user-routes'
import { chatRoutes } from './chat-routes'
import { publicRoutes } from './public-routes'
import { sessionRoutes } from './session-routes'
import { workspaceRoutes } from './workspace-routes'
import type { MockRoute } from '../route-types'

// Every route in ARCHITECTURE.md's REST contract, plus /config.json and /api/public-config.
export const ALL_ROUTES: MockRoute[] = [
  ...publicRoutes,
  ...accountRoutes,
  ...assistRoutes,
  ...sessionRoutes,
  ...chatRoutes,
  ...workspaceRoutes,
  ...adminUserRoutes,
  ...adminCatalogRoutes,
  ...adminOpsRoutes,
]
