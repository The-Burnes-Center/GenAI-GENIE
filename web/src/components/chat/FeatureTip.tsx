import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Lightbulb } from '@phosphor-icons/react'
import { Button } from '../ui'

interface FeatureTipProps {
  title: string
  children: ReactNode
  link?: { to: string; label: string }
  onDismiss: () => void
  className?: string
}

// Menus, pickers and dialogs own Escape while open. Toasts are not in this list, they should not block it.
const OPEN_LAYERS = '[role="menu"],[role="listbox"],.ui-dialog-modal'

// A small inline note above the message box. It never takes focus, stays in the tab order, and goes away on
// "Got it" or Escape (Escape only while focus is in the tip or the message box, and no menu is open).
export function FeatureTip({ title, children, link, onDismiss, className }: FeatureTipProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector(OPEN_LAYERS)) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[data-feature-tip], form[aria-label="Message composer"]')) onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  return (
    <div
      role="group"
      aria-label={`Tip: ${title}`}
      data-feature-tip=""
      className={`animate-rise flex items-start gap-3 rounded-lg border border-warm-edge bg-warm-soft px-3.5 py-3 ${className ?? ''}`}
    >
      <Lightbulb size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-warm" />
      <div className="min-w-0 flex-1">
        <p className="text-ink">
          <b className="font-semibold">{/[.?!]$/.test(title) ? title : `${title}.`}</b> {children}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {link && <Link to={link.to}>{link.label}</Link>}
          <Button size="sm" className="pointer-coarse:min-h-11!" onPress={onDismiss}>Got it</Button>
        </div>
      </div>
    </div>
  )
}
