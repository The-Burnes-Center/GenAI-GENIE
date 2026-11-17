import { CircleNotch } from '@phosphor-icons/react'
import { cx } from './cx'

interface SpinnerProps {
  size?: number
  className?: string
  // Set when the spinner stands alone, so screen readers hear what is happening.
  label?: string
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex">
      <CircleNotch size={size} className={cx('animate-spin-slow', className)} aria-hidden="true" />
      {label && <span className="vh">{label}</span>}
    </span>
  )
}
