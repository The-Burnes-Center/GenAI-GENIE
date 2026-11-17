import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { Button, Input, Label, SearchField as AriaSearchField, type SearchFieldProps } from 'react-aria-components'
import { CONTROL_CLASS, cx } from './cx'

interface Props extends Omit<SearchFieldProps, 'className' | 'children'> {
  label: string
  placeholder?: string
  className?: string
  inputRef?: React.Ref<HTMLInputElement>
}

// The label is visually hidden. Escape or the clear button empties the field.
export function SearchField({ label, placeholder, className, inputRef, ...rest }: Props) {
  return (
    <AriaSearchField {...rest} className={cx('group relative block', className)}>
      <Label className="vh">{label}</Label>
      <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <Input ref={inputRef} placeholder={placeholder ?? label} className={cx(CONTROL_CLASS, 'pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden')} />
      <Button
        aria-label="Clear search"
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-3 outline-none group-data-[empty]:hidden data-[hovered]:bg-hover data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus"
      >
        <X size={14} aria-hidden="true" />
      </Button>
    </AriaSearchField>
  )
}
