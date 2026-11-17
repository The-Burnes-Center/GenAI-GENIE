import type { ComponentProps } from 'react'
import { Popover as AriaPopover } from 'react-aria-components'
import { cx } from './cx'

// Menus, pickers and select lists all use this surface. Under 640 px it becomes a bottom sheet (see app.css).
export function Popover({ className, ...rest }: ComponentProps<typeof AriaPopover>) {
  const resolved = typeof className === 'function' ? undefined : className
  return (
    <AriaPopover
      offset={6}
      {...rest}
      data-sheet=""
      className={cx(
        'ui-popover min-w-[200px] max-w-[min(420px,calc(100vw-16px))] overflow-y-auto rounded-lg border border-edge bg-raised p-1.5 text-ink shadow-pop outline-none',
        resolved,
      )}
    />
  )
}
