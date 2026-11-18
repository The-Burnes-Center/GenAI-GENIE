import { ArrowDown, ArrowUp, X } from '@phosphor-icons/react'
import { IconButton } from '../ui'

interface ListRowControlsProps {
  name: string
  index: number
  count: number
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}

// Up, down and remove for one row of a list editor. Names say which row, for screen readers.
export function ListRowControls({ name, index, count, onMove, onRemove }: ListRowControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconButton size="sm" data-action="up" label={`Move ${name} up`} isDisabled={index === 0} onPress={() => onMove(index, index - 1)}>
        <ArrowUp size={16} aria-hidden="true" />
      </IconButton>
      <IconButton size="sm" data-action="down" label={`Move ${name} down`} isDisabled={index === count - 1} onPress={() => onMove(index, index + 1)}>
        <ArrowDown size={16} aria-hidden="true" />
      </IconButton>
      <IconButton size="sm" label={`Remove ${name}`} onPress={() => onRemove(index)}>
        <X size={16} aria-hidden="true" />
      </IconButton>
    </div>
  )
}
