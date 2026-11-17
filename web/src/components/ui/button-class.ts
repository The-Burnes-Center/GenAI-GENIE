import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'md' | 'sm'

const BASE =
  'press inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap no-underline select-none ' +
  'transition-[background-color,transform] duration-[var(--duration-fast)] data-[pressed]:scale-[.97] ' +
  'outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus data-[focus-visible]:outline-offset-2 ' +
  'data-[disabled]:cursor-not-allowed data-[disabled]:bg-sunken data-[disabled]:border-edge data-[disabled]:text-ink-3 data-[disabled]:scale-100'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent border-accent text-accent-ink data-[hovered]:bg-accent-hover data-[hovered]:border-accent-hover',
  secondary: 'bg-surface border-edge-strong text-ink data-[hovered]:bg-hover',
  ghost: 'bg-transparent border-transparent text-ink data-[hovered]:bg-hover',
  danger: 'bg-danger border-danger text-danger-ink data-[hovered]:bg-danger-hover data-[hovered]:border-danger-hover',
  link: 'border-0 bg-transparent p-0 min-h-0 text-accent underline underline-offset-4 data-[hovered]:text-accent-hover',
}

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-9 px-3.5 pointer-coarse:min-h-11',
  sm: 'min-h-[30px] px-2.5 text-small pointer-coarse:min-h-10',
}

const ICON_SIZES: Record<ButtonSize, string> = {
  md: 'size-9 pointer-coarse:size-11',
  sm: 'size-[30px] pointer-coarse:size-10',
}

export function buttonClass(variant: ButtonVariant, size: ButtonSize, isIcon = false, extra?: string): string {
  const sizing = variant === 'link' ? '' : isIcon ? ICON_SIZES[size] : SIZES[size]
  return cx(BASE, VARIANTS[variant], sizing, extra)
}
