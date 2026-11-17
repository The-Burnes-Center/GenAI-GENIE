import { Plus, X } from '@phosphor-icons/react'
import type { ModelConfig } from '../../api/types'
import { ModelPicker } from '../../components/chat/ModelPicker'
import { IconButton, buttonClass } from '../../components/ui'

const MIN_MODELS = 2

interface CompareModelsProps {
  models: ModelConfig[]
  selected: string[]
  max: number
  defaultModelId: string
  // After the first message the set is fixed: the server stores it with the session.
  isLocked: boolean
  isPickerOpen: boolean
  onPickerOpenChange: (isOpen: boolean) => void
  onChange: (modelIds: string[]) => void
}

// The chosen models as removable chips, plus Add a model. Two at least, up to the admin's limit.
export function CompareModels({ models, selected, max, defaultModelId, isLocked, isPickerOpen, onPickerOpenChange, onChange }: CompareModelsProps) {
  const labelFor = (id: string) => models.find((model) => model.modelId === id)?.label ?? id
  const available = models.filter((model) => !selected.includes(model.modelId))
  const canAdd = !isLocked && selected.length < max && available.length > 0
  return (
    <div role="group" aria-label="Models to compare" className="flex flex-wrap items-center gap-1.5">
      {selected.map((id) => (
        <span key={id} className="inline-flex min-h-8 items-center gap-2 rounded-md border border-edge bg-sunken pl-2.5 text-small pointer-coarse:min-h-10">
          <span>{labelFor(id)}</span>
          {isLocked ? (
            <span className="pr-1" />
          ) : (
            <IconButton
              label={`Remove ${labelFor(id)}`}
              size="sm"
              isDisabled={selected.length <= MIN_MODELS}
              className="size-6! pointer-coarse:size-9!"
              onPress={() => onChange(selected.filter((other) => other !== id))}
            >
              <X size={14} aria-hidden="true" />
            </IconButton>
          )}
        </span>
      ))}
      {!isLocked && (
        <ModelPicker
          models={available}
          selectedId={null}
          defaultModelId={defaultModelId}
          label="Add a model"
          isOpen={isPickerOpen}
          onOpenChange={onPickerOpenChange}
          onSelect={(id) => onChange([...selected, id])}
          isDisabled={!canAdd}
          triggerClassName={buttonClass('secondary', 'sm')}
        >
          <Plus size={14} aria-hidden="true" />
          Add a model
        </ModelPicker>
      )}
    </div>
  )
}
