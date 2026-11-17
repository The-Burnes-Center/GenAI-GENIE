import type { Bootstrap, Me } from '../../api/types'
import { json } from '../http'
import type { MockIdentity } from '../identity'
import { nextDailyReset } from '../chat-body'
import { getStore } from '../store'
import type { MockRoute } from '../route-types'
import { pendingCount } from './shared'

function meFor(identity: MockIdentity): Me {
  return {
    sub: identity.sub,
    email: identity.email,
    isAdmin: identity.isAdmin,
    ...(identity.isAdmin ? { pendingCount: pendingCount() } : {}),
  }
}

export const accountRoutes: MockRoute[] = [
  { method: 'GET', path: '/api/me', access: 'approved', handle: ({ identity }) => json<Me>(meFor(identity)) },
  {
    method: 'GET',
    path: '/api/bootstrap',
    access: 'approved',
    handle: ({ identity }) => {
      const store = getStore()
      return json<Bootstrap>({
        settings: store.settings,
        models: store.models.filter((model) => model.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
        templates: store.templates.filter((template) => template.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
        me: meFor(identity),
        usage: {
          used: store.dailyUsed,
          limit: store.settings.dailyMessageLimit,
          resetsAt: nextDailyReset(),
        },
      })
    },
  },
]
