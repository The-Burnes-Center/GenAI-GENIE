import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'
import {
  applyThemeClass,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
  type ThemePreference,
} from './theme-storage'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setStoredPreference] = useState<ThemePreference>(readStoredTheme)
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark)

  useEffect(() => subscribeToSystemTheme(setPrefersDark), [])

  const resolved = resolveTheme(preference, prefersDark)
  useEffect(() => applyThemeClass(resolved), [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    storeTheme(next)
    setStoredPreference(next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
