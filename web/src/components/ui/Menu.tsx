import type { ComponentProps, ReactNode } from 'react'
import {
  Header,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection,
  MenuTrigger,
  Separator,
  type MenuProps,
} from 'react-aria-components'
import { Popover } from './Popover'
import { cx } from './cx'

export { MenuTrigger, MenuSection }

interface MenuComponentProps<T> extends MenuProps<T> {
  placement?: ComponentProps<typeof Popover>['placement']
}

export function Menu<T extends object>({ className, placement, ...rest }: MenuComponentProps<T>) {
  const resolved = typeof className === 'function' ? undefined : className
  return (
    <Popover placement={placement}>
      <AriaMenu {...rest} className={cx('outline-none', resolved)} />
    </Popover>
  )
}

interface MenuItemProps extends Omit<ComponentProps<typeof AriaMenuItem>, 'className' | 'children'> {
  children: ReactNode
  icon?: ReactNode
  isDanger?: boolean
  // Shortcut hint shown at the end of the row, for example "Alt N".
  shortcut?: string
}

export function MenuItem({ icon, isDanger, shortcut, children, ...rest }: MenuItemProps) {
  return (
    <AriaMenuItem
      {...rest}
      className={cx(
        'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 outline-none pointer-coarse:min-h-11',
        'data-[focused]:bg-hover data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus',
        'data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-3',
        isDanger ? 'text-danger' : 'text-ink',
      )}
    >
      {icon && <span className={cx('shrink-0', isDanger ? 'text-danger' : 'text-ink-2')} aria-hidden="true">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <kbd className="rounded-xs border border-edge-strong px-1.5 text-[11px] leading-[18px] text-ink-3">{shortcut}</kbd>}
    </AriaMenuItem>
  )
}

export function MenuDivider() {
  return <Separator className="-mx-1.5 my-1.5 h-px bg-edge" />
}

export function MenuHeading({ children }: { children: ReactNode }) {
  return <Header className="px-2.5 pb-0.5 pt-1.5 text-caption font-semibold text-ink-2">{children}</Header>
}
