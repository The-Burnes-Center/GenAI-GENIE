import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, segment } from './client'
import { adminKeys, bootstrapKey } from './query-keys'
import type { AdminModelsResponse, ModelConfig, ModelEntryInput, ModelResponse, ModelTestResult } from './types'

export function listAdminModels(): Promise<AdminModelsResponse> {
  return apiFetch<AdminModelsResponse>('/api/admin/models')
}

// The id is the path; the body carries the rest.
export async function upsertModel(model: ModelConfig): Promise<ModelConfig> {
  const { modelId, ...fields } = model
  const body: ModelEntryInput = fields
  const response = await apiFetch<ModelResponse>(`/api/admin/models/${segment(modelId)}`, { method: 'PUT', body })
  return response.model
}

export function deleteModel(modelId: string): Promise<void> {
  return apiFetch<void>(`/api/admin/models/${segment(modelId)}`, { method: 'DELETE' })
}

export function testModel(modelId: string): Promise<ModelTestResult> {
  return apiFetch<ModelTestResult>(`/api/admin/models/${segment(modelId)}/test`, { method: 'POST' })
}

export function useAdminModels() {
  return useQuery({ queryKey: adminKeys.models(), queryFn: listAdminModels })
}

// Model changes also alter the enabled list that every user's bootstrap returns.
export function useUpsertModel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertModel,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.models() }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  })
}

export function useDeleteModel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteModel,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.models() }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  })
}

export function useTestModel() {
  return useMutation({ mutationFn: testModel })
}
