import { useState } from 'react'
import { useAdminSettings, useSaveAdminSettings } from '../../api/admin-content'
import { useDeleteModel, useTestModel, useUpsertModel } from '../../api/admin-models'
import { describeError } from '../../api/errors'
import type { ModelConfig } from '../../api/types'
import { toast } from '../ui'
import type { TestState } from './ModelsTable'
import { DEFAULT_MODEL_OFF_MESSAGE } from './models-helpers'
import type { ConfirmSpec } from './use-confirm'

// Switching, default choice, testing and removal for the models page. Rules the server also enforces
// (default stays on, default can't be removed) are checked here first so the message is immediate.
export function useModelActions(models: ModelConfig[], ask: (spec: ConfirmSpec) => void) {
  const settings = useAdminSettings()
  const saveSettings = useSaveAdminSettings()
  const upsert = useUpsertModel()
  const remove = useDeleteModel()
  const test = useTestModel()
  const [tests, setTests] = useState<Record<string, TestState | undefined>>({})
  const defaultModelId = settings.data?.defaultModelId ?? ''

  const fail = (error: unknown) => void toast.error(describeError(error))

  const toggle = (model: ModelConfig) => {
    if (model.enabled && model.modelId === defaultModelId) {
      toast.error(DEFAULT_MODEL_OFF_MESSAGE)
      return
    }
    upsert.mutate({ ...model, enabled: !model.enabled }, { onError: fail })
  }

  const makeDefault = (modelId: string) => {
    const model = models.find((item) => item.modelId === modelId)
    if (!settings.data || !model || modelId === defaultModelId) return
    if (!model.enabled) {
      toast.error('Turn the model on before making it the default.')
      return
    }
    saveSettings.mutate(
      { ...settings.data, defaultModelId: modelId },
      { onSuccess: () => toast.show(`${model.label} is now the default.`), onError: fail },
    )
  }

  const runTest = async (model: ModelConfig) => {
    setTests((prev) => ({ ...prev, [model.modelId]: { status: 'pending' } }))
    try {
      const result = await test.mutateAsync(model.modelId)
      setTests((prev) => ({ ...prev, [model.modelId]: { status: 'done', result } }))
    } catch (error) {
      setTests((prev) => ({ ...prev, [model.modelId]: { status: 'done', result: { ok: false, latencyMs: 0, error: describeError(error) } } }))
    }
  }

  const askRemove = (model: ModelConfig) =>
    ask({
      title: `Remove ${model.label}?`,
      body: 'Staff will no longer be able to use it. You can add it back later from the available list.',
      confirmLabel: 'Remove model',
      onConfirm: async () => {
        await remove.mutateAsync(model.modelId)
        toast.show('Model removed.')
      },
    })

  return { settings, defaultModelId, tests, toggle, makeDefault, runTest, askRemove }
}
