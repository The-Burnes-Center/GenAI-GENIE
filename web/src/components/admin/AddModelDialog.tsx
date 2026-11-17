import { useState, type FormEvent } from 'react'
import { describeError } from '../../api/errors'
import { useUpsertModel } from '../../api/admin-models'
import type { AvailableModel } from '../../api/types'
import { Badge, Button, Dialog, DialogFooter, InlineNotice, RadioGroup, TextField, toast } from '../ui'
import { newModelFrom } from './models-helpers'

interface AddModelDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  available: AvailableModel[]
  nextSortOrder: number
}

export function AddModelDialog({ isOpen, onOpenChange, available, nextSortOrder }: AddModelDialogProps) {
  return (
    <Dialog title="Add a model" isOpen={isOpen} onOpenChange={onOpenChange} isWide>
      {(close) =>
        available.length === 0 ? (
          <>
            <p className="text-ink-2">Every model in your AWS account is already in Genie.</p>
            <DialogFooter><Button onPress={close}>Close</Button></DialogFooter>
          </>
        ) : (
          <AddForm available={available} nextSortOrder={nextSortOrder} close={close} />
        )
      }
    </Dialog>
  )
}

function AddForm({ available, nextSortOrder, close }: { available: AvailableModel[]; nextSortOrder: number; close: () => void }) {
  const upsert = useUpsertModel()
  const [selectedId, setSelectedId] = useState(available[0]?.modelId ?? '')
  const [label, setLabel] = useState(available[0]?.label ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const choose = (modelId: string) => {
    setSelectedId(modelId)
    setLabel(available.find((item) => item.modelId === modelId)?.label ?? '')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const chosen = available.find((item) => item.modelId === selectedId)
    if (!chosen) return
    if (label.trim() === '') {
      setProblem('Enter the name people will see.')
      return
    }
    setProblem(null)
    upsert.mutate(newModelFrom(chosen, label.trim(), nextSortOrder), {
      onSuccess: () => {
        toast.show('Model added, turned off. Test it, then turn it on.')
        close()
      },
      onError: (error) => setServerError(describeError(error)),
    })
  }

  const options = available.map((item) => ({
    value: item.modelId,
    label: item.label,
    description: (
      <>
        <Badge className="mr-2">{item.provider}</Badge>
        <span className="font-mono">{item.modelId}</span>
      </>
    ),
  }))

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-4">
      <p className="text-ink-2">These models are available in your AWS account but not in Genie yet. A new model starts turned off.</p>
      <RadioGroup label="Available models" options={options} value={selectedId} onChange={choose} />
      <TextField label="Name people will see" value={label} onChange={setLabel} errorMessage={problem ?? undefined} />
      {serverError && <InlineNotice tone="bad">{serverError}</InlineNotice>}
      <DialogFooter>
        <Button onPress={close}>Cancel</Button>
        <Button type="submit" variant="primary" isPending={upsert.isPending} pendingLabel="Adding">Add model</Button>
      </DialogFooter>
    </form>
  )
}
