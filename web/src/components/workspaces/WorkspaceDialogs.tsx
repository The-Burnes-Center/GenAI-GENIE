import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { describeError } from '../../api/errors'
import type { Workspace, WorkspaceVisibility } from '../../api/types'
import { useCreateWorkspace, useUpdateWorkspace } from '../../api/workspaces'
import { Button, Dialog, DialogFooter, InlineNotice, RadioGroup, TextField } from '../ui'

interface DialogState {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const NAME_MAX = 80
const DESCRIPTION_MAX = 160

export function NewWorkspaceDialog({ isOpen, onOpenChange, canShare }: DialogState & { canShare: boolean }) {
  return (
    <Dialog title="New workspace" isOpen={isOpen} onOpenChange={onOpenChange}>
      {(close) => <NewWorkspaceForm canShare={canShare} close={close} />}
    </Dialog>
  )
}

function NewWorkspaceForm({ canShare, close }: { canShare: boolean; close: () => void }) {
  const navigate = useNavigate()
  const create = useCreateWorkspace()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<WorkspaceVisibility>('personal')
  const [nameError, setNameError] = useState<string>()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() === '') return setNameError('Enter a name for the workspace.')
    create.mutate(
      { name: name.trim(), description: description.trim(), visibility },
      {
        onSuccess: (workspace) => {
          close()
          navigate(`/workspaces/${workspace.workspaceId}`)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <TextField
        autoFocus
        label="Name"
        value={name}
        onChange={(value) => {
          setName(value)
          setNameError(undefined)
        }}
        maxLength={NAME_MAX}
        placeholder="For example: Grant guidelines"
        errorMessage={nameError}
      />
      <TextField label="What is it for? (optional)" value={description} onChange={setDescription} maxLength={DESCRIPTION_MAX} />
      <RadioGroup
        label="Who can use it"
        value={visibility}
        onChange={(value) => setVisibility(value as WorkspaceVisibility)}
        options={[
          { value: 'personal', label: 'Only me', description: 'Private to your account.' },
          {
            value: 'shared',
            label: 'Everyone at the organization',
            description: canShare ? 'All staff can ask questions of these documents.' : 'Only administrators can create shared workspaces.',
            isDisabled: !canShare,
          },
        ]}
      />
      {create.isError && <InlineNotice tone="bad">{describeError(create.error)}</InlineNotice>}
      <DialogFooter>
        <Button onPress={close}>Cancel</Button>
        <Button type="submit" variant="primary" isPending={create.isPending} pendingLabel="Creating">Create workspace</Button>
      </DialogFooter>
    </form>
  )
}

export function EditWorkspaceDialog({ isOpen, onOpenChange, workspace }: DialogState & { workspace: Workspace }) {
  return (
    <Dialog title="Rename workspace" isOpen={isOpen} onOpenChange={onOpenChange}>
      {(close) => <EditWorkspaceForm workspace={workspace} close={close} />}
    </Dialog>
  )
}

function EditWorkspaceForm({ workspace, close }: { workspace: Workspace; close: () => void }) {
  const update = useUpdateWorkspace(workspace.workspaceId)
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)
  const [nameError, setNameError] = useState<string>()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() === '') return setNameError('Enter a name for the workspace.')
    update.mutate({ name: name.trim(), description: description.trim() }, { onSuccess: close })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <TextField autoFocus label="Name" value={name} onChange={setName} maxLength={NAME_MAX} errorMessage={nameError} />
      <TextField label="Description" value={description} onChange={setDescription} maxLength={DESCRIPTION_MAX} />
      {update.isError && <InlineNotice tone="bad">{describeError(update.error)}</InlineNotice>}
      <DialogFooter>
        <Button onPress={close}>Cancel</Button>
        <Button type="submit" variant="primary" isPending={update.isPending} pendingLabel="Saving">Save</Button>
      </DialogFooter>
    </form>
  )
}
