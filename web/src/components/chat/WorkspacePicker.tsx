import { Books, Check } from '@phosphor-icons/react'
import { Button as AriaButton, ListBox, ListBoxItem, Select, Text } from 'react-aria-components'
import type { Workspace } from '../../api/types'
import { Badge, Popover, buttonClass, cx } from '../ui'

interface WorkspacePickerProps {
  workspaces: Workspace[]
  workspaceId: string
  onChange: (workspaceId: string) => void
}

const NONE = 'none'

// "No workspace" first, then each workspace with a shared or personal badge.
export function WorkspacePicker({ workspaces, workspaceId, onChange }: WorkspacePickerProps) {
  return (
    <Select
      aria-label="Ask over a workspace"
      selectedKey={workspaceId || NONE}
      onSelectionChange={(key) => onChange(key === NONE || key === null ? '' : String(key))}
    >
      <AriaButton className={buttonClass('ghost', 'sm', false, 'gap-1.5! px-2! sm:px-2.5!')}>
        <Books size={20} aria-hidden="true" />
        <span className="max-sm:vh">Workspace</span>
      </AriaButton>
      <Popover placement="top start" className="w-[min(340px,calc(100vw-16px))]">
        <ListBox aria-label="Workspaces" className="outline-none">
          <WorkspaceOption id={NONE} label="No workspace" />
          {workspaces.map((workspace) => (
            <WorkspaceOption key={workspace.workspaceId} id={workspace.workspaceId} label={workspace.name} badge={workspace.visibility === 'shared' ? 'Shared' : 'Personal'} />
          ))}
        </ListBox>
      </Popover>
    </Select>
  )
}

function WorkspaceOption({ id, label, badge }: { id: string; label: string; badge?: string }) {
  return (
    <ListBoxItem
      id={id}
      textValue={label}
      className={cx(
        'group flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 outline-none pointer-coarse:min-h-11',
        'data-[focused]:bg-hover data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-focus',
      )}
    >
      <Text slot="label" className="min-w-0 flex-1 truncate">{label}</Text>
      {badge && <Badge>{badge}</Badge>}
      <Check size={18} aria-hidden="true" className="hidden shrink-0 text-accent group-data-[selected]:block" />
    </ListBoxItem>
  )
}
