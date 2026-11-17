import { useState, type FormEvent } from 'react'
import { describeError } from '../../api/errors'
import { useUpsertModel } from '../../api/admin-models'
import type { Capabilities, ModelConfig } from '../../api/types'
import { Button, Checkbox, Dialog, DialogFooter, InlineNotice, TextField, toast } from '../ui'
import { applyDraft, draftFromModel, validateDraft, type ModelDraft, type ModelDraftErrors } from './models-helpers'

const CAPABILITY_LABELS: Array<[keyof Capabilities, string]> = [
  ['vision', 'Can read images'],
  ['documents', 'Can read documents and spreadsheets'],
  ['reasoning', 'Can think before answering'],
  ['temperature', 'Accepts a creativity setting'],
  ['promptCache', 'Supports saving repeated text for speed'],
]

interface ModelEditDialogProps {
  model: ModelConfig | null
  onOpenChange: (open: boolean) => void
}

export function ModelEditDialog({ model, onOpenChange }: ModelEditDialogProps) {
  return (
    <Dialog title="Edit model" isOpen={model !== null} onOpenChange={onOpenChange} isWide>
      {(close) => (model ? <EditForm model={model} close={close} /> : null)}
    </Dialog>
  )
}

function NumberField({ label, field, draft, errors, onChange, description }: {
  label: string
  field: 'contextWindow' | 'maxOutputTokens' | 'sortOrder'
  draft: ModelDraft
  errors: ModelDraftErrors
  onChange: (field: keyof ModelDraft, value: string) => void
  description?: string
}) {
  return (
    <TextField
      label={label}
      description={description}
      inputMode="numeric"
      inputClassName="font-mono"
      value={draft[field]}
      onChange={(value) => onChange(field, value)}
      errorMessage={errors[field]}
    />
  )
}

function EditForm({ model, close }: { model: ModelConfig; close: () => void }) {
  const upsert = useUpsertModel()
  const [draft, setDraft] = useState<ModelDraft>(() => draftFromModel(model))
  const [errors, setErrors] = useState<ModelDraftErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const setField = (field: keyof ModelDraft, value: string) => setDraft((prev) => ({ ...prev, [field]: value }))
  const setCapability = (key: keyof Capabilities, value: boolean) =>
    setDraft((prev) => ({ ...prev, capabilities: { ...prev.capabilities, [key]: value } }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setServerError(null)
    upsert.mutate(applyDraft(model, draft), {
      onSuccess: () => {
        toast.show('Model saved.')
        close()
      },
      onError: (error) => setServerError(describeError(error)),
    })
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-4">
      <p className="font-mono text-small text-ink-3">{model.modelId}</p>
      <TextField label="Name people will see" autoFocus value={draft.label} onChange={(value) => setField('label', value)} errorMessage={errors.label} />
      <TextField label="Description" multiline rows={2} value={draft.description} onChange={(value) => setField('description', value)} />
      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="mb-1 font-medium">What it can do</legend>
        {CAPABILITY_LABELS.map(([key, label]) => (
          <Checkbox key={key} isSelected={draft.capabilities[key]} onChange={(value) => setCapability(key, value)}>{label}</Checkbox>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Context window" field="contextWindow" draft={draft} errors={errors} onChange={setField} description="Tokens it can read at once." />
        <NumberField label="Longest answer" field="maxOutputTokens" draft={draft} errors={errors} onChange={setField} description="Tokens it can write." />
        <NumberField label="Sort order" field="sortOrder" draft={draft} errors={errors} onChange={setField} description="Lower comes first." />
      </div>
      {serverError && <InlineNotice tone="bad">{serverError}</InlineNotice>}
      <DialogFooter>
        <Button onPress={close}>Cancel</Button>
        <Button type="submit" variant="primary" isPending={upsert.isPending} pendingLabel="Saving">Save model</Button>
      </DialogFooter>
    </form>
  )
}
