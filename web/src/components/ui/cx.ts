// Joins class names, skipping falsy values.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

// Shared look of a text control boundary (inputs, select buttons, combo boxes).
export const CONTROL_CLASS =
  'w-full min-h-10 pointer-coarse:min-h-11 px-3 py-2 rounded-md border border-edge-strong bg-surface text-ink ' +
  'text-body md:text-ui outline-none data-[focused]:border-focus data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus ' +
  'data-[focus-visible]:outline-offset-0 data-[invalid]:border-danger data-[disabled]:bg-sunken data-[disabled]:text-ink-3 ' +
  'data-[disabled]:cursor-not-allowed'

// Visible focus ring for buttons, rows and other non-input controls.
export const FOCUS_RING = 'outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-focus data-[focus-visible]:outline-offset-2'
