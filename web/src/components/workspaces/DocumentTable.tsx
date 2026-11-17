import { FilePdf, FileText, Trash, UploadSimple } from '@phosphor-icons/react'
import { ProgressBar } from 'react-aria-components'
import { describeError } from '../../api/errors'
import type { WorkspaceDocument } from '../../api/types'
import { useRetryDocument } from '../../api/workspaces'
import { Badge, Button, IconButton, StatusChip, Table, toast, type TableColumn } from '../ui'
import { buildDocRows, canRetry, type DocRow, type LocalUpload } from './document-rows'
import { formatDate, formatSize } from './format'

interface DocumentTableProps {
  workspaceId: string
  documents: WorkspaceDocument[]
  uploads: LocalUpload[]
  canManage: boolean
  onDelete: (doc: WorkspaceDocument) => void
  onDismiss: (uploadId: string) => void
}

function rowName(row: DocRow): string {
  return row.kind === 'local' ? row.upload.name : row.doc.name
}

function NameCell({ row }: { row: DocRow }) {
  const name = rowName(row)
  const Icon = name.toLowerCase().endsWith('.pdf') ? FilePdf : FileText
  const error = row.kind === 'local' ? row.upload.error : row.doc.error
  return (
    <>
      <span className="flex items-center gap-2 font-medium">
        <Icon size={20} className="shrink-0 text-ink-3" aria-hidden="true" />
        <span className="truncate">{name}</span>
      </span>
      {error && <span className="mt-1 block text-small text-danger">{error}</span>}
    </>
  )
}

function UploadingStatus({ upload }: { upload: LocalUpload }) {
  if (upload.error) return <StatusChip status="failed" label="Upload failed" />
  const percent = Math.round(upload.fraction * 100)
  return (
    <>
      <Badge icon={<UploadSimple size={14} aria-hidden="true" />}>{`Uploading ${percent}%`}</Badge>
      <ProgressBar value={percent} aria-label={`Uploading ${upload.name}`} className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-edge">
        <div className="h-full bg-accent transition-[width] duration-[var(--duration-base)] ease-linear" style={{ width: `${percent}%` }} />
      </ProgressBar>
    </>
  )
}

function StatusCell({ row }: { row: DocRow }) {
  if (row.kind === 'local') return <UploadingStatus upload={row.upload} />
  const { status } = row.doc
  if (status === 'uploading') return <StatusChip status="indexing" label="Adding file" />
  if (status === 'uploaded') return <StatusChip status="waiting" label="Waiting to index" />
  if (status === 'indexing') return <StatusChip status="indexing" label="Getting ready" />
  return <StatusChip status={status} />
}

export function DocumentTable({ workspaceId, documents, uploads, canManage, onDelete, onDismiss }: DocumentTableProps) {
  const retry = useRetryDocument(workspaceId)
  const rows = buildDocRows(documents, uploads)

  const retryDocument = (doc: WorkspaceDocument) =>
    retry.mutate(doc.docId, { onError: (error) => toast.error(describeError(error)) })

  const actions = (row: DocRow) => {
    if (row.kind === 'local') {
      return row.upload.error ? <Button size="sm" onPress={() => onDismiss(row.upload.id)}>Dismiss</Button> : null
    }
    return (
      <>
        {canRetry(row.doc) && (
          <Button size="sm" isPending={retry.isPending && retry.variables === row.doc.docId} pendingLabel="Retrying" onPress={() => retryDocument(row.doc)}>
            Retry
          </Button>
        )}
        <IconButton size="sm" label={`Remove ${row.doc.name}`} onPress={() => onDelete(row.doc)}>
          <Trash size={18} aria-hidden="true" />
        </IconButton>
      </>
    )
  }

  const columns: TableColumn<DocRow>[] = [
    { id: 'name', header: 'Document', width: 'minmax(0,2.5fr)', isPrimary: true, cell: (row) => <NameCell row={row} /> },
    { id: 'size', header: 'Size', width: '90px', cell: (row) => formatSize(row.kind === 'local' ? row.upload.size : row.doc.size) },
    { id: 'added', header: 'Added', width: '120px', cell: (row) => (row.kind === 'local' ? 'Today' : formatDate(row.doc.createdAt)) },
    { id: 'status', header: 'Status', width: '190px', cell: (row) => <StatusCell row={row} /> },
    ...(canManage ? [{ id: 'actions', header: 'Actions', width: '150px', isActions: true, cell: actions } satisfies TableColumn<DocRow>] : []),
  ]

  return <Table ariaLabel="Documents" columns={columns} rows={rows} getRowId={(row) => row.id} />
}
