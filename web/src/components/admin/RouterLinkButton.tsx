import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui'

interface RouterLinkButtonProps {
  to: string
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  'aria-label'?: string
}

// Looks like a button but navigates inside the app, through a react-router Link.
export function RouterLinkButton({ to, children, variant = 'secondary', size = 'md', ...rest }: RouterLinkButtonProps) {
  return <Link to={to} aria-label={rest['aria-label']} className={buttonClass(variant, size, false, 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus')}>{children}</Link>
}
