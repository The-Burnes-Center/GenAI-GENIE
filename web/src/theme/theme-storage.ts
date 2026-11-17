export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'genie-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isPreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage is unavailable: the choice lasts for this page view only.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false
}

export function subscribeToSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY)
  if (!query) return () => undefined
  const listener = () => onChange(query.matches)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}

export function applyThemeClass(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}
