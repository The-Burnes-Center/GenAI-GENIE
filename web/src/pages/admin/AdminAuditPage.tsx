import { ClipboardText } from '@phosphor-icons/react'
import { useAdminAudit } from '../../api/admin-ops'
import type { AuditEntry } from '../../api/types'
import { formatWhen, summarizeDetails } from '../../components/admin/audit-format'
import { PageHead } from '../../components/admin/PageHead'
import { QueryError, TableSkeleton } from '../../components/admin/states'
import { EmptyState, LoadMore, Table, type TableColumn } from '../../components/ui'

const COLUMNS: TableColumn<AuditEntry>[] = [
  { id: 'when', header: 'When', width: '150px', isPrimary: true, cell: (row) => formatWhen(row.at) },
  { id: 'who', header: 'Who', width: 'minmax(0,1.6fr)', cell: (row) => <span className="block truncate font-medium">{row.actorEmail}</span> },
  { id: 'action', header: 'Action', width: '160px', cell: (row) => row.action },
  { id: 'target', header: 'Target', width: 'minmax(0,1.4fr)', cell: (row) => <span className="block truncate">{row.target}</span> },
  { id: 'details', header: 'Details', width: 'minmax(0,1.4fr)', cell: (row) => <span className="text-ink-2">{summarizeDetails(row.details)}</span> },
]

export function AdminAuditPage() {
  const audit = useAdminAudit()
  return (
    <>
      <PageHead title="Audit log" lead="Who changed what in the admin console, newest first." />
      {audit.isPending && <TableSkeleton label="Loading the audit log" />}
      {audit.isError && <QueryError what="the audit log" error={audit.error} onRetry={() => void audit.refetch()} />}
      {audit.isSuccess && (
        <Table
          ariaLabel="Audit log"
          columns={COLUMNS}
          rows={audit.items}
          getRowId={(row) => `${row.at}|${row.actorSub}|${row.action}|${row.target}`}
          empty={<EmptyState icon={<ClipboardText />} title="Nothing in the log yet">Admin changes will be listed here.</EmptyState>}
        />
      )}
      <LoadMore hasNextPage={Boolean(audit.hasNextPage)} isFetchingNextPage={audit.isFetchingNextPage} fetchNextPage={() => void audit.fetchNextPage()} />
    </>
  )
}
