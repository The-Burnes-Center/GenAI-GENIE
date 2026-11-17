import type { ReactNode } from 'react'
import { Brain, Check, FileText, Image as ImageIcon } from '@phosphor-icons/react'
import { Button as AriaButton, Header, ListBox, ListBoxItem, ListBoxSection, Select, Text } from 'react-aria-components'
import type { ModelConfig } from '../../api/types'
import { groupByProvider, readsLine, THINK_HINT } from '../../chat/model-hints'
import { Popover, cx } from '../ui'

interface ModelPickerProps {
  models: ModelConfig[]
  // The highlighted model. Leave null when the picker only adds models (compare).
  selectedId: string | null
  defaultModelId: string
  // Models that cannot be chosen for a reason, for example "Can't see the image you attached".
  disabledReasons?: Record<string, string>
  label: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (modelId: string) => void
  triggerClassName: string
  children: ReactNode
  isDisabled?: boolean
}

// Models grouped by provider, a line on what each can read, and a sheet from the bottom on phones.
export function ModelPicker({
  models,
  selectedId,
  defaultModelId,
  disabledReasons = {},
  label,
  isOpen,
  onOpenChange,
  onSelect,
  triggerClassName,
  children,
  isDisabled,
}: ModelPickerProps) {
  const groups = groupByProvider([...models].sort((a, b) => a.sortOrder - b.sortOrder))
  return (
    <Select
      aria-label={label}
      selectedKey={selectedId}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDisabled={isDisabled}
      onSelectionChange={(key) => key !== null && onSelect(String(key))}
    >
      <AriaButton className={triggerClassName}>{children}</AriaButton>
      <Popover placement="top start" className="w-[min(400px,calc(100vw-16px))]">
        <ListBox aria-label={label} className="outline-none">
          {groups.map((group) => (
            <ListBoxSection key={group.provider}>
              <Header className="px-2.5 pb-0.5 pt-1.5 text-caption font-semibold text-ink-2">{group.provider}</Header>
              {group.models.map((model) => (
                <ModelOption key={model.modelId} model={model} isDefault={model.modelId === defaultModelId} reason={disabledReasons[model.modelId]} />
              ))}
            </ListBoxSection>
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}

function ModelOption({ model, isDefault, reason }: { model: ModelConfig; isDefault: boolean; reason?: string }) {
  const readsImages = model.capabilities.vision
  const Reads = readsImages ? ImageIcon : FileText
  return (
    <ListBoxItem
      id={model.modelId}
      textValue={model.label}
      isDisabled={Boolean(reason)}
      className={cx(
        'group flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 outline-none',
        'data-[focused]:bg-hover data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus',
        'data-[disabled]:cursor-not-allowed',
      )}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <Text slot="label" className="flex items-center gap-2 font-medium group-data-[disabled]:text-ink-3">
          {model.label}
          {isDefault && <span className="rounded-xs bg-accent-soft px-1.5 text-caption font-medium text-accent-soft-ink">Default</span>}
        </Text>
        {model.description && <Text slot="description" className="text-small text-ink-2 group-data-[disabled]:text-ink-3">{model.description}</Text>}
        {reason ? (
          <span className="text-caption text-danger">{reason}</span>
        ) : (
          <span className="flex flex-wrap gap-x-3 text-caption text-ink-3">
            <span className="inline-flex items-center gap-1"><Reads size={14} aria-hidden="true" />{readsLine(model.capabilities)}</span>
            {model.capabilities.reasoning && <span className="inline-flex items-center gap-1"><Brain size={14} aria-hidden="true" />{THINK_HINT}</span>}
          </span>
        )}
      </span>
      <Check size={18} aria-hidden="true" className="mt-0.5 hidden shrink-0 text-accent group-data-[selected]:block" />
    </ListBoxItem>
  )
}
