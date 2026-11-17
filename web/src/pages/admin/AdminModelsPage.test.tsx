import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelConfig } from '../../api/types'
import { DEFAULT_MODEL_OFF_MESSAGE } from '../../components/admin/models-helpers'
import { toast } from '../../components/ui/toast-queue'
import { AdminModelsPage } from './AdminModelsPage'

function model(modelId: string, label: string): ModelConfig {
  return {
    modelId, label, provider: 'Acme', description: '', enabled: true, sortOrder: 1, contextWindow: 100_000, maxOutputTokens: 4096,
    capabilities: { vision: false, documents: true, reasoning: false, temperature: false, promptCache: false },
  }
}

const upsert = vi.fn()

vi.mock('../../api/admin-models', () => ({
  useAdminModels: () => ({
    isPending: false, isError: false, isSuccess: true,
    data: { items: [model('a', 'Alpha'), model('b', 'Beta')], available: [] },
  }),
  useUpsertModel: () => ({ mutate: upsert, isPending: false }),
  useDeleteModel: () => ({ mutateAsync: vi.fn() }),
  useTestModel: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('../../api/admin-content', () => ({
  useAdminSettings: () => ({ isPending: false, isError: false, isSuccess: true, data: { defaultModelId: 'a' } }),
  useSaveAdminSettings: () => ({ mutate: vi.fn() }),
}))

describe('AdminModelsPage', () => {
  beforeEach(() => upsert.mockClear())

  it('refuses to turn off the default model', () => {
    const error = vi.spyOn(toast, 'error').mockReturnValue('k')
    render(<MemoryRouter><AdminModelsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('switch', { name: 'Alpha is available to staff' }))
    expect(error).toHaveBeenCalledWith(DEFAULT_MODEL_OFF_MESSAGE)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('turns off a model that is not the default', () => {
    render(<MemoryRouter><AdminModelsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('switch', { name: 'Beta is available to staff' }))
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'b', enabled: false }), expect.anything())
  })
})
