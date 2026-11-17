import type { FeedbackFilters } from './types'

// Prefix keys so that invalidating ['sessions'] also refreshes every session view.
export const sessionKeys = {
  all: ['sessions'] as const,
  list: (query: string) => ['sessions', 'list', query] as const,
  detail: (id: string) => ['sessions', 'detail', id] as const,
}

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => ['workspaces', 'list'] as const,
  detail: (id: string) => ['workspaces', 'detail', id] as const,
}

export const adminKeys = {
  all: ['admin'] as const,
  users: (status?: string) => ['admin', 'users', status ?? 'all'] as const,
  models: () => ['admin', 'models'] as const,
  settings: () => ['admin', 'settings'] as const,
  templates: () => ['admin', 'templates'] as const,
  usage: (from: string, to: string) => ['admin', 'usage', from, to] as const,
  feedback: (filters: FeedbackFilters) => ['admin', 'feedback', filters] as const,
  audit: () => ['admin', 'audit'] as const,
}

export const bootstrapKey = ['bootstrap'] as const

export const publicConfigKey = ['publicConfig'] as const
