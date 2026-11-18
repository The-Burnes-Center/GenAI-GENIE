import type { Bootstrap, HintId, HintsResponse, Me } from '../../api/types'
import { json, MockHttpError, readJson } from '../http'
import { HINT_IDS, withHint } from '../../chat/hints'
import { seededHints, type MockIdentity } from '../identity'
import { nextDailyReset } from '../chat-body'
import { getStore } from '../store'
import type { MockRoute } from '../route-types'
import { pendingCount } from './shared'

function hintsFor(email: string): HintId[] {
  const store = getStore()
  return store.hints[email] ?? (seededHints().filter((id) => HINT_IDS.includes(id as HintId)) as HintId[])
}

function meFor(identity: MockIdentity): Me {
  return {
    sub: identity.sub,
    email: identity.email,
    isAdmin: identity.isAdmin,
    hints: hintsFor(identity.email),
    ...(identity.isAdmin ? { pendingCount: pendingCount() } : {}),
  }
}

async function markHint(request: Request, identity: MockIdentity): Promise<Response> {
  const body = await readJson<{ hint?: unknown }>(request)
  if (typeof body.hint !== 'string' || !HINT_IDS.includes(body.hint as HintId)) {
    throw new MockHttpError(400, 'BAD_REQUEST', 'That tip is not one Genie knows.')
  }
  const store = getStore()
  store.hints[identity.email] = withHint(hintsFor(identity.email), body.hint as HintId)
  return json<HintsResponse>({ hints: store.hints[identity.email] })
}

export const accountRoutes: MockRoute[] = [
  { method: 'POST', path: '/api/me/hints', access: 'approved', handle: ({ request, identity }) => markHint(request, identity) },
  {
    method: 'DELETE',
    path: '/api/me/hints',
    access: 'approved',
    handle: ({ identity }) => {
      getStore().hints[identity.email] = []
      return json<HintsResponse>({ hints: [] })
    },
  },
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
