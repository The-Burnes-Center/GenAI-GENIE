import type { ReactNode } from 'react'

// Standard page container: gutters 16 px on phones and 32 px from 768, admin width cap.
export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[var(--container-admin)] px-4 pb-16 pt-4 md:px-8 md:pb-20 md:pt-6">{children}</div>
}
