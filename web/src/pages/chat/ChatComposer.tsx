import type { RefObject } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { SelectValue } from 'react-aria-components'
import type { AttachmentRef, ModelConfig, Workspace } from '../../api/types'
import { modelBlockedByFiles, pickCapableModel, type AttachWarning } from '../../chat/attach-rules'
import type { useAttachments } from '../../chat/use-attachments'
import { AttachMenu } from '../../components/chat/AttachMenu'
import { Composer, ThinkToggle } from '../../components/chat/Composer'
import { ModelPicker } from '../../components/chat/ModelPicker'
import { WorkspacePicker } from '../../components/chat/WorkspacePicker'
import { buttonClass } from '../../components/ui'

interface ChatComposerProps {
  attachments: ReturnType<typeof useAttachments>
  warnings: AttachWarning[]
  models: ModelConfig[]
  model: ModelConfig
  defaultModelId: string
  onModelChange: (modelId: string, reason?: 'switch') => void
  isModelPickerOpen: boolean
  onModelPickerOpenChange: (isOpen: boolean) => void
  workspaces: Workspace[]
  workspaceId: string
  onWorkspaceChange: (workspaceId: string) => void
  isThinkingDeep: boolean
  onThinkingChange: (isDeep: boolean) => void
  isStreaming: boolean
  closedReason?: string
  isOffline: boolean
  initialPrompt?: string
  contextChips: { label: string; icon: 'template' | 'workspace'; onRemove: () => void }[]
  onSend: (prompt: string, attachments: AttachmentRef[]) => void
  onStop: () => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

// The chat composer with its tools: attach, workspace, think harder, and the model picker.
export function ChatComposer(props: ChatComposerProps) {
  const { attachments, model, models } = props
  const fileNames = attachments.items
  const blockedReasons = Object.fromEntries(
    models.flatMap((candidate) => {
      const reason = modelBlockedByFiles(candidate, fileNames)
      return reason ? [[candidate.modelId, reason]] : []
    }),
  )
  const capable = pickCapableModel(models, fileNames, model.modelId)
  const visionModel = pickCapableModel(models, [{ name: 'image.png', size: 1 }], model.modelId)

  return (
    <Composer
      inputId="prompt"
      routeFocus
      attachments={attachments}
      warnings={props.warnings}
      onFix={capable ? () => props.onModelChange(capable.modelId, 'switch') : undefined}
      isStreaming={props.isStreaming}
      closedReason={props.closedReason}
      isOffline={props.isOffline}
      initialPrompt={props.initialPrompt}
      contextChips={props.contextChips}
      onSend={props.onSend}
      onStop={props.onStop}
      textareaRef={props.textareaRef}
      tools={
        <>
          <AttachMenu
            canSeeImages={model.capabilities.vision}
            imageReason={`${model.label} can't see images.`}
            onFiles={attachments.add}
            onSwitchModel={visionModel ? () => props.onModelChange(visionModel.modelId, 'switch') : undefined}
            isDisabled={Boolean(props.closedReason) || props.isOffline || props.isStreaming}
          />
          {props.workspaces.length > 0 && (
            <WorkspacePicker workspaces={props.workspaces} workspaceId={props.workspaceId} onChange={props.onWorkspaceChange} />
          )}
          {model.capabilities.reasoning && <ThinkToggle isSelected={props.isThinkingDeep} onChange={props.onThinkingChange} />}
        </>
      }
      trailing={
        <ModelPicker
          models={models}
          selectedId={model.modelId}
          defaultModelId={props.defaultModelId}
          disabledReasons={blockedReasons}
          label="Model"
          isOpen={props.isModelPickerOpen}
          onOpenChange={props.onModelPickerOpenChange}
          onSelect={(id) => props.onModelChange(id)}
          isDisabled={Boolean(props.closedReason) || props.isStreaming}
          triggerClassName={buttonClass('ghost', 'sm', false, 'min-w-0 max-w-[140px] gap-1.5! px-2! sm:max-w-[240px]')}
        >
          <span className="truncate"><SelectValue>{({ selectedText }) => selectedText ?? model.label}</SelectValue></span>
          <CaretDown size={14} aria-hidden="true" className="shrink-0" />
        </ModelPicker>
      }
    />
  )
}
