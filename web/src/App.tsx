import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { createQueryClient } from './api/query-client'
import { configureAuth, loadConfig } from './config'
import { AuthProvider } from './auth/AuthProvider'
import { MockAuthProvider } from './mock/MockAuthProvider'
import { StartupError } from './components/StartupError'
import { ThemeProvider } from './theme/ThemeProvider'
import { router } from './router'

const queryClient = createQueryClient()
// Dead code in production builds: VITE_MOCK is unset, so the mock provider is never referenced.
const AuthProviderImpl = import.meta.env.VITE_MOCK === '1' ? MockAuthProvider : AuthProvider

type Startup = 'loading' | 'ready' | 'error'

// Config is loaded before anything touches Amplify, so auth never runs unconfigured.
export function App() {
  const [startup, setStartup] = useState<Startup>('loading')

  useEffect(() => {
    let active = true
    loadConfig()
      .then((config) => {
        configureAuth(config)
        if (active) setStartup('ready')
      })
      .catch((error: unknown) => {
        console.error('Genie could not load its configuration.', error)
        if (active) setStartup('error')
      })
    return () => {
      active = false
    }
  }, [])

  if (startup === 'loading') return <p role="status" className="p-8 text-ink-3">Loading Genie...</p>
  if (startup === 'error') return <StartupError />

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProviderImpl>
          <RouterProvider router={router} />
        </AuthProviderImpl>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
