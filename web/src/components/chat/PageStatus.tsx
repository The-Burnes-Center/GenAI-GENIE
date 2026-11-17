import type { ReactNode } from 'react'

// Padding for a loading or error line shown on its own in the page.
export function PageStatus({ children }: { children: ReactNode }) {
  return <div className="p-8">{children}</div>
}
