import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  children?: ReactNode
  // Usually a Button or LinkButton.
  action?: ReactNode
  // Heading level for the title. Pages pass the level that follows their own heading.
  headingLevel?: 2 | 3
}

export function EmptyState({ icon, title, children, action, headingLevel = 2 }: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className="grid justify-items-center gap-2 px-4 py-12 text-center text-ink-2">
      {icon && <span className="text-ink-3 [&>svg]:size-8" aria-hidden="true">{icon}</span>}
      <Heading className="text-title font-semibold text-ink">{title}</Heading>
      {children && <p className="max-w-[44ch]">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
