import { createContext } from 'react'
import type { AuthContextValue } from './AuthContext'

// Kept apart from the component and the hook so that each module exports one kind of thing.
export const AuthContext = createContext<AuthContextValue | null>(null)
