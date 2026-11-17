import type { ComponentProps, ReactNode } from 'react'
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components'
import { Spinner } from './Spinner'
import { cx } from './cx'
import { buttonClass, type ButtonSize, type ButtonVariant } from './button-class'

interface ButtonProps extends Omit<ComponentProps<typeof AriaButton>, 'className' | 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children?: ReactNode
  // Replaces the label with a spinner and keeps the button's width.
  isPending?: boolean
  pendingLabel?: string
}

export function Button({ variant = 'secondary', size = 'md', className, children, isPending, pendingLabel, ...rest }: ButtonProps) {
  return (
    <AriaButton
      {...rest}
      // RAC's own isPending announces through an image-role node that axe rejects, so pending is handled here.
      aria-disabled={isPending || undefined}
      onPress={isPending ? undefined : rest.onPress}
      type={isPending ? 'button' : rest.type}
      className={buttonClass(variant, size, false, className)}>
      {isPending ? (
        <span className="relative inline-flex items-center justify-center">
          <span className="invisible inline-flex items-center gap-2" aria-hidden="true">{children}</span>
          <span className="absolute inline-flex items-center gap-2"><Spinner />{pendingLabel}</span>
        </span>
      ) : (
        children
      )}
    </AriaButton>
  )
}

interface IconButtonProps extends Omit<ComponentProps<typeof AriaButton>, 'className' | 'children' | 'aria-label'> {
  // Icon-only buttons always need a name.
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

export function IconButton({ label, variant = 'ghost', size = 'md', className, children, ...rest }: IconButtonProps) {
  return (
    <AriaButton {...rest} aria-label={label} className={buttonClass(variant, size, true, cx('px-0', className))}>
      {children}
    </AriaButton>
  )
}

interface LinkButtonProps extends Omit<ComponentProps<typeof AriaLink>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

// A real link (router navigation) that looks like a button.
export function LinkButton({ variant = 'secondary', size = 'md', className, ...rest }: LinkButtonProps) {
  return <AriaLink {...rest} className={buttonClass(variant, size, false, className)} />
}
