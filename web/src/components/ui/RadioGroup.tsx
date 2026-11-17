import type { ReactNode } from 'react'
import { Label, Radio, RadioGroup as AriaRadioGroup, type RadioGroupProps as AriaRadioGroupProps } from 'react-aria-components'
import { cx } from './cx'

export interface RadioOption {
  value: string
  label: string
  description?: ReactNode
  isDisabled?: boolean
}

interface RadioGroupProps extends Omit<AriaRadioGroupProps, 'className' | 'children'> {
  label: string
  options: RadioOption[]
  // 'segmented' is a compact control (theme); 'cards' are bordered rows (sign-up mode, visibility).
  variant?: 'segmented' | 'cards'
  className?: string
}

export function RadioGroup({ label, options, variant = 'cards', className, ...rest }: RadioGroupProps) {
  const isSegmented = variant === 'segmented'
  return (
    <AriaRadioGroup {...rest} className={cx('grid gap-2', className)}>
      <Label className={isSegmented ? 'vh' : 'font-medium'}>{label}</Label>
      <div className={isSegmented ? 'inline-flex gap-0.5 justify-self-start rounded-md border border-edge-strong bg-surface p-0.5' : 'grid gap-2'}>
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            isDisabled={option.isDisabled}
            className={
              isSegmented
                ? 'flex min-h-[30px] cursor-pointer items-center rounded-sm px-3 text-small font-medium text-ink-2 outline-none pointer-coarse:min-h-10 ' +
                  'data-[selected]:bg-accent data-[selected]:text-accent-ink data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus'
                : 'group flex cursor-pointer items-start gap-2.5 rounded-md border border-edge-strong p-3 outline-none data-[selected]:bg-accent-soft ' +
                  'data-[disabled]:cursor-not-allowed data-[disabled]:bg-sunken data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus'
            }
          >
            {isSegmented ? (
              option.label
            ) : (
              <>
                <span className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border border-edge-strong bg-surface group-data-[selected]:border-accent">
                  <span className="hidden size-2.5 rounded-full bg-accent group-data-[selected]:block" />
                </span>
                <span>
                  <span className="block font-medium">{option.label}</span>
                  {option.description && <span className="block text-small text-ink-3">{option.description}</span>}
                </span>
              </>
            )}
          </Radio>
        ))}
      </div>
    </AriaRadioGroup>
  )
}
