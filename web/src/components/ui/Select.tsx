import type { ReactNode } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Select as AriaSelect,
  SelectValue,
  Text,
  type SelectProps as AriaSelectProps,
} from 'react-aria-components'
import { Popover } from './Popover'
import { FieldErrorLine } from './TextField'
import { CONTROL_CLASS, cx } from './cx'

export interface SelectOption {
  id: string
  label: string
  description?: string
  isDisabled?: boolean
}

interface SelectProps extends Omit<AriaSelectProps<SelectOption>, 'className' | 'children' | 'items'> {
  label: string
  options: SelectOption[]
  description?: ReactNode
  errorMessage?: string
  className?: string
  // Hides the visible label (kept for screen readers), for compact toolbars and table cells.
  isLabelHidden?: boolean
}

export function Select({ label, options, description, errorMessage, className, isLabelHidden, ...rest }: SelectProps) {
  return (
    <AriaSelect {...rest} isInvalid={rest.isInvalid ?? Boolean(errorMessage)} className={cx('grid gap-1.5', className)}>
      <Label className={isLabelHidden ? 'vh' : 'font-medium'}>{label}</Label>
      <Button className={cx(CONTROL_CLASS, 'flex items-center justify-between gap-2 text-left data-[focus-visible]:border-focus')}>
        <SelectValue className="truncate data-[placeholder]:text-ink-3" />
        <CaretDown size={16} className="shrink-0 text-ink-3" aria-hidden="true" />
      </Button>
      {description && <Text slot="description" className="text-small text-ink-3">{description}</Text>}
      {errorMessage && <FieldErrorLine>{errorMessage}</FieldErrorLine>}
      <Popover className="min-w-[var(--trigger-width)]">
        <ListBox items={options} className="outline-none">
          {(option) => <OptionItem option={option} />}
        </ListBox>
      </Popover>
    </AriaSelect>
  )
}

export function OptionItem({ option }: { option: SelectOption }) {
  return (
    <ListBoxItem
      id={option.id}
      textValue={option.label}
      isDisabled={option.isDisabled}
      className={
        'flex min-h-9 cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 outline-none pointer-coarse:min-h-11 ' +
        'data-[focused]:bg-hover data-[selected]:bg-selected data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-3 ' +
        'data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus'
      }
    >
      <span className="flex-1">
        <span className="block font-medium">{option.label}</span>
        {option.description && <span className="block text-small text-ink-2">{option.description}</span>}
      </span>
      <Check size={16} className="mt-0.5 hidden text-accent [[data-selected]_&]:block" aria-hidden="true" />
    </ListBoxItem>
  )
}
