import { createContext, useContext, useEffect } from 'react'

export interface TopbarValue {
  title: string
  // Muted text after the title, for example the model and workspace.
  meta?: string
}

interface TopbarContextValue {
  set: (value: TopbarValue | null) => void
}

export const TopbarContext = createContext<TopbarContextValue>({ set: () => undefined })

// Pages call this to fill the topbar and the browser tab title. Pass null title to leave it empty.
export function useTopbar(title: string, meta?: string): void {
  const { set } = useContext(TopbarContext)
  useEffect(() => {
    set({ title, meta })
    document.title = title ? `${title} | Genie` : 'Genie'
    return () => set(null)
  }, [set, title, meta])
}
