import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, segment } from './client'
import { adminKeys, bootstrapKey } from './query-keys'
import type {
  AdminSettingsResponse,
  Settings,
  SettingsResponse,
  Template,
  TemplateInput,
  TemplateListResponse,
  TemplateResponse,
} from './types'

export async function getAdminSettings(): Promise<Settings> {
  const { settings } = await apiFetch<AdminSettingsResponse>('/api/admin/settings')
  return settings
}

export async function saveAdminSettings(input: Settings): Promise<Settings> {
  const { settings } = await apiFetch<SettingsResponse>('/api/admin/settings', { method: 'PUT', body: input })
  return settings
}

export async function listAdminTemplates(): Promise<Template[]> {
  const { templates } = await apiFetch<TemplateListResponse>('/api/admin/templates')
  return templates
}

// The id is the path; the body carries the rest.
export async function upsertTemplate(template: Template): Promise<Template> {
  const { templateId, ...fields } = template
  const body: TemplateInput = fields
  const response = await apiFetch<TemplateResponse>(`/api/admin/templates/${segment(templateId)}`, {
    method: 'PUT',
    body,
  })
  return response.template
}

export function deleteTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/templates/${segment(id)}`, { method: 'DELETE' })
}

export function useAdminSettings() {
  return useQuery({ queryKey: adminKeys.settings(), queryFn: getAdminSettings })
}

export function useSaveAdminSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveAdminSettings,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.settings() }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  })
}

export function useAdminTemplates() {
  return useQuery({ queryKey: adminKeys.templates(), queryFn: listAdminTemplates })
}

export function useUpsertTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertTemplate,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.templates() }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.templates() }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  })
}
