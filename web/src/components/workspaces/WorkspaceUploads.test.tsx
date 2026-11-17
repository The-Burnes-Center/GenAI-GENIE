import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setTokenProvider } from '../../auth/auth-service'
import { mockHandlers } from '../../mock/handlers'
import { MOCK_TOKEN } from '../../mock/identity'
import { resetMockForTests } from '../../mock/test-utils'
import { WorkspaceDetailPage } from '../../pages/WorkspaceDetailPage'
import { ToastHost } from '../ui'
import { rejectionMessage } from './use-document-uploads'

const server = setupServer(...mockHandlers)

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/workspaces/w1']}>
        <ToastHost />
        <Routes>
          <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('workspace document upload validation', () => {
  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'bypass' })
    setTokenProvider(async () => MOCK_TOKEN)
  })
  afterAll(() => server.close())
  beforeEach(() => resetMockForTests())

  it('explains a rejected file type in a toast and adds no row', async () => {
    renderDetail()
    const input = await screen.findByTestId('document-input')
    const rowsBefore = screen.getAllByRole('row').length
    fireEvent.change(input, { target: { files: [new File(['x'], 'archive.zip', { type: 'application/zip' })] } })
    expect(await screen.findByText(/Genie can't read \.zip files/)).toBeTruthy()
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(rowsBefore))
  })

  it('rejects oversize and empty files with the validator wording', () => {
    expect(rejectionMessage({ name: 'big.pdf', size: 60_000_000 })).toContain('larger than 50 MB')
    expect(rejectionMessage({ name: 'empty.txt', size: 0 })).toContain('is empty')
    expect(rejectionMessage({ name: 'ok.pdf', size: 1000 })).toBeNull()
  })
})
