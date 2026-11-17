import type {
  AdminModelsResponse,
  AdminSettingsResponse,
  ModelConfig,
  ModelEntryInput,
  ModelResponse,
  ModelTestResult,
  Settings,
  SettingsResponse,
  Template,
  TemplateInput,
  TemplateListResponse,
  TemplateResponse,
} from '../../api/types'
import { AVAILABLE_MODELS, MODEL_TEST_RESULTS, SETTINGS_HELP } from '../seed-catalog'
import { json, noContent, MockHttpError, readJson, requireText } from '../http'
import { getStore } from '../store'
import type { MockRoute } from '../route-types'
import type { MockIdentity } from '../identity'
import { recordAudit } from './shared'

function bySortOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder)
}

function findModel(modelId: string): ModelConfig {
  const model = getStore().models.find((item) => item.modelId === modelId)
  if (!model) throw new MockHttpError(404, 'NOT_FOUND', 'That model could not be found.')
  return model
}

function upsertModel(modelId: string, body: Partial<ModelEntryInput>): ModelConfig {
  const store = getStore()
  const model: ModelConfig = {
    capabilities: { vision: false, documents: false, reasoning: false, temperature: false, promptCache: false, ...body.capabilities },
    ...(typeof body.defaultTemperature === 'number' ? { defaultTemperature: body.defaultTemperature } : {}),
    contextWindow: typeof body.contextWindow === 'number' ? body.contextWindow : 128_000,
    maxOutputTokens: typeof body.maxOutputTokens === 'number' ? body.maxOutputTokens : 4_096,
    modelId,
    label: requireText(body.label, 'label'),
    provider: typeof body.provider === 'string' ? body.provider : 'Other',
    description: typeof body.description === 'string' ? body.description : '',
    enabled: body.enabled !== false,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : store.models.length + 1,
  }
  const index = store.models.findIndex((item) => item.modelId === modelId)
  if (index < 0) store.models.push(model)
  else store.models[index] = model
  return model
}

function upsertTemplate(templateId: string, body: Partial<TemplateInput>): Template {
  const store = getStore()
  const template: Template = {
    templateId,
    title: requireText(body.title, 'title'),
    description: typeof body.description === 'string' ? body.description : '',
    category: typeof body.category === 'string' ? body.category : 'Writing',
    systemPrompt: typeof body.systemPrompt === 'string' ? body.systemPrompt : '',
    starterPrompt: typeof body.starterPrompt === 'string' ? body.starterPrompt : '',
    enabled: body.enabled !== false,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : store.templates.length + 1,
  }
  const index = store.templates.findIndex((item) => item.templateId === templateId)
  if (index < 0) store.templates.push(template)
  else store.templates[index] = template
  return template
}

function removeModel(modelId: string, identity: MockIdentity): Response {
  const store = getStore()
  const model = findModel(modelId)
  if (modelId === store.settings.defaultModelId) {
    throw new MockHttpError(409, 'CONFLICT', 'Choose another default model before removing this one.')
  }
  store.models.splice(store.models.indexOf(model), 1)
  recordAudit(identity, 'Removed model', model.label, 'Removed from the catalog')
  return noContent()
}

async function saveSettings(request: Request, identity: MockIdentity): Promise<Response> {
  const body = await readJson<Partial<Settings>>(request)
  const store = getStore()
  store.settings = { ...store.settings, ...body }
  recordAudit(identity, 'Changed settings', 'Settings', 'Saved from the console')
  return json<SettingsResponse>({ settings: store.settings })
}

export const adminCatalogRoutes: MockRoute[] = [
  {
    method: 'GET',
    path: '/api/admin/models',
    access: 'admin',
    handle: () => {
      const catalogIds = new Set(getStore().models.map((model) => model.modelId))
      return json<AdminModelsResponse>({
        items: bySortOrder(getStore().models),
        available: AVAILABLE_MODELS.filter((model) => !catalogIds.has(model.modelId)),
      })
    },
  },
  {
    method: 'PUT',
    path: '/api/admin/models/:modelId',
    access: 'admin',
    handle: async ({ params, request, identity }) => {
      const model = upsertModel(params.modelId, await readJson<Partial<ModelEntryInput>>(request))
      recordAudit(identity, 'Changed model', model.label, model.enabled ? 'Enabled: on' : 'Enabled: off')
      return json<ModelResponse>({ model })
    },
  },
  { method: 'DELETE', path: '/api/admin/models/:modelId', access: 'admin', handle: ({ params, identity }) => removeModel(params.modelId, identity) },
  {
    method: 'POST',
    path: '/api/admin/models/:modelId/test',
    access: 'admin',
    handle: ({ params, identity }) => {
      const model = findModel(params.modelId)
      const result: ModelTestResult = MODEL_TEST_RESULTS[model.modelId] ?? { ok: true, latencyMs: 900 }
      recordAudit(identity, 'Tested model', model.label, result.ok ? 'Passed' : `Failed: ${result.error ?? 'error'}`)
      return json<ModelTestResult>(result)
    },
  },
  { method: 'GET', path: '/api/admin/settings', access: 'admin', handle: () => json<AdminSettingsResponse>({ settings: getStore().settings, help: SETTINGS_HELP }) },
  { method: 'PUT', path: '/api/admin/settings', access: 'admin', handle: ({ request, identity }) => saveSettings(request, identity) },
  {
    method: 'GET',
    path: '/api/admin/templates',
    access: 'admin',
    handle: () => json<TemplateListResponse>({ templates: bySortOrder(getStore().templates) }),
  },
  {
    method: 'PUT',
    path: '/api/admin/templates/:id',
    access: 'admin',
    handle: async ({ params, request, identity }) => {
      const template = upsertTemplate(params.id, await readJson<Partial<TemplateInput>>(request))
      recordAudit(identity, 'Edited template', template.title, 'Saved from the console')
      return json<TemplateResponse>({ template })
    },
  },
  {
    method: 'DELETE',
    path: '/api/admin/templates/:id',
    access: 'admin',
    handle: ({ params, identity }) => {
      const store = getStore()
      const template = store.templates.find((item) => item.templateId === params.id)
      if (!template) throw new MockHttpError(404, 'NOT_FOUND', 'That template could not be found.')
      store.templates.splice(store.templates.indexOf(template), 1)
      recordAudit(identity, 'Deleted template', template.title, 'Removed')
      return noContent()
    },
  },
]
