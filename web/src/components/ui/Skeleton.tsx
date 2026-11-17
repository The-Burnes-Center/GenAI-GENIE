import { cx } from './cx'

interface SkeletonProps {
  className?: string
}

// Decorative placeholder. Wrap a group in an element with role="status" and a visible-hidden label.
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cx('animate-skeleton h-3.5 rounded-sm bg-hover', className)} />
}

export function SkeletonLines({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div role="status" className="grid gap-2.5">
      <span className="vh">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={index === count - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  )
}
