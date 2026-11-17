import type { ReactNode } from 'react'
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from 'react-aria-components'
import { cx } from './cx'

interface SwitchProps extends Omit<AriaSwitchProps, 'className' | 'children'> {
  children: ReactNode
  // Hides the label visually (it stays available to screen readers), for use inside tables.
  isLabelHidden?: boolean
  className?: string
}

export function Switch({ children, isLabelHidden, className, ...rest }: SwitchProps) {
  return (
    <AriaSwitch {...rest} className={cx('group inline-flex items-center gap-3 outline-none', className)}>
      <span
        className={
          'relative h-6 w-10 shrink-0 rounded-full bg-edge-strong transition-colors duration-[var(--duration-fast)] ' +
          'group-data-[selected]:bg-accent group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-3 ' +
          'group-data-[focus-visible]:outline-focus group-data-[disabled]:opacity-50 pointer-coarse:my-1'
        }
      >
        <span
          className={
            'absolute left-[3px] top-[3px] size-[18px] rounded-full bg-surface transition-transform duration-[var(--duration-base)] ' +
            'ease-[var(--ease-out)] group-data-[selected]:translate-x-4 group-data-[selected]:bg-accent-ink'
          }
        />
      </span>
      <span className={isLabelHidden ? 'vh' : undefined}>{children}</span>
    </AriaSwitch>
  )
}
