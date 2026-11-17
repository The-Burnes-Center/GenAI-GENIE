import { useState, type ReactNode } from 'react'
import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react'
import {
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components'
import { IconButton } from './Button'
import { CONTROL_CLASS, cx } from './cx'

export interface TextFieldProps extends Omit<AriaTextFieldProps, 'className' | 'children'> {
  label: string
  description?: ReactNode
  // Server or form error text. Shown below the field with an icon and linked by aria-describedby.
  errorMessage?: string
  placeholder?: string
  multiline?: boolean
  rows?: number
  className?: string
  inputClassName?: string
  inputRef?: React.Ref<HTMLInputElement>
  maxLength?: number
  inputMode?: 'text' | 'numeric' | 'email' | 'search'
  trailing?: ReactNode
}

export function FieldErrorLine({ children }: { children: ReactNode }) {
  return (
    <FieldError className="flex items-start gap-1.5 text-small text-danger">
      <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </FieldError>
  )
}

// Label above, helper below, error below with an icon. 40 px tall (44 on coarse pointers).
export function TextField({
  label, description, errorMessage, placeholder, multiline, rows = 4, className, inputClassName, inputRef,
  maxLength, inputMode, trailing, ...rest
}: TextFieldProps) {
  return (
    <AriaTextField {...rest} isInvalid={rest.isInvalid ?? Boolean(errorMessage)} className={cx('grid gap-1.5', className)}>
      <Label className="font-medium">{label}</Label>
      <div className="relative">
        {multiline ? (
          <TextArea placeholder={placeholder} rows={rows} className={cx(CONTROL_CLASS, 'min-h-24 resize-y leading-6', inputClassName)} />
        ) : (
          <Input
            ref={inputRef}
            placeholder={placeholder}
            maxLength={maxLength}
            inputMode={inputMode}
            className={cx(CONTROL_CLASS, Boolean(trailing) && 'pr-12', inputClassName)}
          />
        )}
        {trailing}
      </div>
      {description && <Text slot="description" className="text-small text-ink-3">{description}</Text>}
      {errorMessage && <FieldErrorLine>{errorMessage}</FieldErrorLine>}
    </AriaTextField>
  )
}

// Password input with a Show/Hide toggle. Paste is never blocked.
export function PasswordField({ label, ...rest }: Omit<TextFieldProps, 'type' | 'trailing'>) {
  const [isShown, setIsShown] = useState(false)
  return (
    <TextField
      {...rest}
      label={label}
      type={isShown ? 'text' : 'password'}
      trailing={
        <span className="absolute right-1 top-1/2 -translate-y-1/2">
          <IconButton
            size="sm"
            aria-pressed={isShown}
            label={`${isShown ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            onPress={() => setIsShown((shown) => !shown)}
          >
            {isShown ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
          </IconButton>
        </span>
      }
    />
  )
}
