import { useContext } from 'react'
import { AuthContext } from './auth-context-object'
import type { AuthContextValue } from './AuthContext'

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
