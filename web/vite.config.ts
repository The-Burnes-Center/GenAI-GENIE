/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Mock mode only (npm run dev:mock): serves MSW's worker script from node_modules at /mockServiceWorker.js.
// It is never copied into public/, so dist/ has no worker file.
function mockWorkerPlugin(): Plugin {
  return {
    name: 'genie-mock-worker',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VITE_MOCK !== '1') return
      const workerPath = resolve(process.cwd(), 'node_modules/msw/lib/mockServiceWorker.js')
      server.middlewares.use('/mockServiceWorker.js', (_request, response) => {
        response.setHeader('Content-Type', 'application/javascript')
        response.end(readFileSync(workerPath, 'utf8'))
      })
    },
  }
}

// Local dev only: point VITE_GENIE_URL at a deployed CloudFront origin to
// proxy /api and /config.json, so the dev server talks to real backend data.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const genieUrl = env.VITE_GENIE_URL
  const proxy = genieUrl
    ? {
        '/api': { target: genieUrl, changeOrigin: true },
        '/config.json': { target: genieUrl, changeOrigin: true },
      }
    : undefined

  return {
    plugins: [react(), tailwindcss(), mockWorkerPlugin()],
    server: { proxy },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
    },
  }
})
