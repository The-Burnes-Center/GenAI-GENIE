import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/app.css'

// Mock mode (npm run dev:mock) starts MSW before anything renders. With VITE_MOCK unset this branch
// is dead code, so rollup drops the mock import and nothing under src/mock ships.
async function startApp(): Promise<void> {
  if (import.meta.env.VITE_MOCK === '1') {
    const { startMock } = await import('./mock/start')
    await startMock()
  }
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Missing #root element in index.html.')

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void startApp()
