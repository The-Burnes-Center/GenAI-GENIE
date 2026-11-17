import type { ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import {
  Button,
  ComboBox as AriaComboBox,
  Input,
  Label,
  ListBox,
  Text,
  type ComboBoxProps as AriaComboBoxProps,
} from 'react-aria-components'
import { OptionItem, type SelectOption } from './Select'
import { Popover } from './Popover'
import { FieldErrorLine } from './TextField'
import { CONTROL_CLASS, cx } from './cx'

interface ComboBoxProps extends Omit<AriaComboBoxProps<SelectOption>, 'className' | 'children' | 'items' | 'defaultItems'> {
  label: string
  options: SelectOption[]
  description?: ReactNode
  errorMessage?: string
  placeholder?: string
  className?: string
}

// A text field with a filtered list, for long lists such as models or domains.
export function ComboBox({ label, options, description, errorMessage, placeholder, className, ...rest }: ComboBoxProps) {
  return (
    <AriaComboBox {...rest} defaultItems={options} isInvalid={rest.isInvalid ?? Boolean(errorMessage)} className={cx('grid gap-1.5', className)}>
      <Label className="font-medium">{label}</Label>
      <div className="relative">
        <Input placeholder={placeholder} className={cx(CONTROL_CLASS, 'pr-10')} />
        <Button className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-3 outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus">
          <CaretDown size={16} aria-hidden="true" />
        </Button>
      </div>
      {description && <Text slot="description" className="text-small text-ink-3">{description}</Text>}
      {errorMessage && <FieldErrorLine>{errorMessage}</FieldErrorLine>}
      <Popover className="min-w-[var(--trigger-width)]">
        <ListBox className="outline-none" renderEmptyState={() => <p className="px-2.5 py-2 text-ink-3">No matches.</p>}>
          {(option: SelectOption) => <OptionItem option={option} />}
        </ListBox>
      </Popover>
    </AriaComboBox>
  )
}
