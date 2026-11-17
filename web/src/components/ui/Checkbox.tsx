import type { ReactNode } from 'react'
import { Check } from '@phosphor-icons/react'
import { Checkbox as AriaCheckbox, type CheckboxProps as AriaCheckboxProps } from 'react-aria-components'
import { cx } from './cx'

interface CheckboxProps extends Omit<AriaCheckboxProps, 'className' | 'children'> {
  children: ReactNode
  className?: string
}

export function Checkbox({ children, className, ...rest }: CheckboxProps) {
  return (
    <AriaCheckbox {...rest} className={cx('group flex items-start gap-2.5 outline-none', className)}>
      <span
        className={
          'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-xs border border-edge-strong bg-surface text-accent-ink ' +
          'group-data-[selected]:border-accent group-data-[selected]:bg-accent ' +
          'group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-focus'
        }
      >
        <Check size={14} weight="bold" className="hidden group-data-[selected]:block" aria-hidden="true" />
      </span>
      <span>{children}</span>
    </AriaCheckbox>
  )
}
