import { User, UsersThree } from '@phosphor-icons/react'
import type { WorkspaceVisibility } from '../../api/types'
import { Badge } from '../ui'

export function WorkspaceBadge({ visibility }: { visibility: WorkspaceVisibility }) {
  const isShared = visibility === 'shared'
  const Icon = isShared ? UsersThree : User
  return (
    <Badge tone={isShared ? 'accent' : 'neutral'} icon={<Icon size={14} aria-hidden="true" />}>
      {isShared ? 'Shared' : 'Personal'}
    </Badge>
  )
}
