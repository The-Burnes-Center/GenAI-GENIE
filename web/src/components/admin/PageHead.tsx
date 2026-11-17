import type { ReactNode } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { useTopbar } from '../../layout/topbar-context'

interface PageHeadProps {
  title: string
  // Shown next to the title, for example a badge.
  titleAddon?: ReactNode
  lead?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}

// Standard page heading for workspaces, history and the admin console. Sets the topbar and tab title.
export function PageHead({ title, titleAddon, lead, actions, back }: PageHeadProps) {
  useTopbar(title)
  return (
    <>
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 font-medium text-ink-2 no-underline hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 tabIndex={-1} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-h1 font-semibold">
            {title}
            {titleAddon}
          </h1>
          {lead && <p className="mt-1 max-w-[60ch] text-body text-ink-2">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </>
  )
}

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 mt-8 text-title font-semibold first:mt-0">{children}</h2>
}
