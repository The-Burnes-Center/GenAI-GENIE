import { UploadSimple } from '@phosphor-icons/react'

// Accent wash while files are dragged over the chat. Attaching also works from the Attach menu.
export function DropOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-accent-soft/90 text-accent-soft-ink"
    >
      <p className="flex items-center gap-2 text-title font-medium">
        <UploadSimple size={24} />
        Drop files to attach them
      </p>
    </div>
  )
}
