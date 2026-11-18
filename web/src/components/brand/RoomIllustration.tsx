// Spot illustration drawn from the Room mark: a box with a slot in its left wall and a line passing through.
// It is decoration only (aria-hidden). The line slides in once on mount, and nothing moves under reduced motion.
interface RoomIllustrationProps {
  size?: number
  className?: string
  // Draws a third text line inside the room, for the Learn page.
  isBusy?: boolean
}

export function RoomIllustration({ size = 96, className, isBusy = false }: RoomIllustrationProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      <path
        d="M7.5 25V17.5A6 6 0 0 1 13.5 11.5H50.5A6 6 0 0 1 56.5 17.5V46.5A6 6 0 0 1 50.5 52.5H13.5A6 6 0 0 1 7.5 46.5V39V25Z"
        fill="var(--color-surface)"
        stroke="none"
      />
      <path
        d="M7.5 25V17.5A6 6 0 0 1 13.5 11.5H50.5A6 6 0 0 1 56.5 17.5V46.5A6 6 0 0 1 50.5 52.5H13.5A6 6 0 0 1 7.5 46.5V39"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="5"
      />
      <g className="room-text" fill="var(--color-warm)">
        <rect x="26" y="18.5" width="24" height="5" rx="2.5" />
        <rect x="26" y="38.5" width="16" height="5" rx="2.5" />
        {isBusy && <rect x="26" y="45.5" width="10" height="3" rx="1.5" />}
      </g>
      <rect className="room-line" x="1" y="29" width="38" height="6" rx="3" fill="var(--color-accent)" />
    </svg>
  )
}
