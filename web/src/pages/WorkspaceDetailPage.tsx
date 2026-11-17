import { useState } from 'react'
import { ChatText, DotsThree, PencilSimple, Trash } from '@phosphor-icons/react'
import { useNavigate, useParams } from 'react-router'
import { useBootstrap } from '../api/bootstrap'
import { ApiError } from '../api/client'
import type { WorkspaceDetail, WorkspaceDocument } from '../api/types'
import { useDeleteWorkspace, useDeleteWorkspaceDocument, useWorkspace } from '../api/workspaces'
import { PageHead, SectionTitle } from '../components/admin/PageHead'
import { QueryError, TableSkeleton } from '../components/admin/states'
import { useConfirm } from '../components/admin/use-confirm'
import { Button, EmptyState, IconButton, InlineNotice, Menu, MenuItem, MenuTrigger, toast } from '../components/ui'
import { DocumentTable } from '../components/workspaces/DocumentTable'
import { DropZone } from '../components/workspaces/DropZone'
import { EditWorkspaceDialog } from '../components/workspaces/WorkspaceDialogs'
import { WorkspaceBadge } from '../components/workspaces/WorkspaceBadge'
import { useDocumentUploads } from '../components/workspaces/use-document-uploads'

export function WorkspaceDetailPage() {
  const { id = '' } = useParams()
  const detail = useWorkspace(id)
  const navigate = useNavigate()

  if (detail.isPending) return <TableSkeleton label="Loading workspace" />
  if (detail.isError) {
    if (detail.error instanceof ApiError && detail.error.status === 404) {
      return (
        <EmptyState title="We can't find that workspace" action={<Button variant="primary" onPress={() => navigate('/workspaces')}>All workspaces</Button>}>
          It may have been deleted, or it may belong to someone else.
        </EmptyState>
      )
    }
    return <QueryError what="this workspace" error={detail.error} onRetry={() => void detail.refetch()} />
  }
  return <WorkspaceView detail={detail.data} />
}

function WorkspaceView({ detail }: { detail: WorkspaceDetail }) {
  const { workspace, documents } = detail
  const navigate = useNavigate()
  const me = useBootstrap().data?.me
  const canManage = Boolean(me && (me.isAdmin || me.sub === workspace.ownerSub))
  const { uploads, addFiles, dismiss } = useDocumentUploads(workspace.workspaceId)
  const removeDocument = useDeleteWorkspaceDocument(workspace.workspaceId)
  const removeWorkspace = useDeleteWorkspace()
  const { ask, dialog } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)

  const confirmDeleteDocument = (doc: WorkspaceDocument) =>
    ask({
      title: 'Remove this document?',
      body: `"${doc.name}" will be removed from ${workspace.name}. Genie will stop using it in answers.`,
      confirmLabel: 'Remove document',
      onConfirm: async () => {
        await removeDocument.mutateAsync(doc.docId)
        toast.show('Document removed.')
      },
    })

  const confirmDeleteWorkspace = () =>
    ask({
      title: 'Delete this workspace?',
      body: `"${workspace.name}" and all ${documents.length} of its documents will be deleted. Chats that used it keep their answers. This can't be undone.`,
      confirmLabel: 'Delete workspace',
      onConfirm: async () => {
        await removeWorkspace.mutateAsync(workspace.workspaceId)
        toast.show('Workspace deleted.')
        navigate('/workspaces')
      },
    })

  const actions = (
    <>
      <Button variant="primary" onPress={() => navigate(`/home?workspace=${workspace.workspaceId}`)}>
        <ChatText size={16} aria-hidden="true" />
        Chat with this workspace
      </Button>
      {canManage && (
        <MenuTrigger>
          <IconButton variant="secondary" label="Workspace actions"><DotsThree size={20} weight="bold" aria-hidden="true" /></IconButton>
          <Menu aria-label="Workspace actions" placement="bottom end" onAction={(key) => (key === 'rename' ? setIsEditing(true) : confirmDeleteWorkspace())}>
            <MenuItem id="rename" icon={<PencilSimple size={18} />}>Rename or edit description</MenuItem>
            <MenuItem id="delete" icon={<Trash size={18} />} isDanger>Delete workspace</MenuItem>
          </Menu>
        </MenuTrigger>
      )}
    </>
  )

  return (
    <div className="animate-view">
      <PageHead
        title={workspace.name}
        titleAddon={<WorkspaceBadge visibility={workspace.visibility} />}
        lead={workspace.description || 'No description yet.'}
        back={{ to: '/workspaces', label: 'All workspaces' }}
        actions={actions}
      />
      {canManage ? (
        <DropZone onFiles={addFiles} />
      ) : (
        <InlineNotice>{`Shared by ${workspace.ownerEmail}. Only the owner or an administrator can add or remove documents.`}</InlineNotice>
      )}
      <SectionTitle>Documents</SectionTitle>
      <p className="-mt-2 mb-3 text-small text-ink-3">Getting ready usually takes a minute or two. This list updates on its own.</p>
      {documents.length === 0 && uploads.length === 0 ? (
        <EmptyState title="No documents yet" headingLevel={3}>
          Drop files above. Genie reads them so you can ask questions about what is inside.
        </EmptyState>
      ) : (
        <DocumentTable workspaceId={workspace.workspaceId} documents={documents} uploads={uploads} canManage={canManage} onDelete={confirmDeleteDocument} onDismiss={dismiss} />
      )}
      {dialog}
      {isEditing && <EditWorkspaceDialog isOpen={isEditing} onOpenChange={setIsEditing} workspace={workspace} />}
    </div>
  )
}
