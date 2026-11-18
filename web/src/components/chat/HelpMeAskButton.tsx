import { PencilSimpleLine } from '@phosphor-icons/react'
import { Button, Tooltip } from '../ui'

interface HelpMeAskButtonProps {
  isOpen: boolean
  isDisabled: boolean
  onPress: () => void
}

// Always labeled, even on phones: this is the one tool people have never seen before.
export function HelpMeAskButton({ isOpen, isDisabled, onPress }: HelpMeAskButtonProps) {
  return (
    <Tooltip text="Rewrite your request so it is clearer">
      <Button variant="ghost" size="sm" aria-expanded={isOpen} isDisabled={isDisabled} onPress={onPress} className="gap-1.5! px-2.5! pointer-coarse:min-h-11!">
        <PencilSimpleLine size={20} aria-hidden="true" />
        Help me ask
      </Button>
    </Tooltip>
  )
}
