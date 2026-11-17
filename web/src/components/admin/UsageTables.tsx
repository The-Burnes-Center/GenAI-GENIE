import type { UsageRow } from './usage-rows'
import { Table, type TableColumn } from '../ui'
import { formatCompact, formatCount, formatDayLabel } from './usage-range'

function withShare(rows: UsageRow[]) {
  const max = Math.max(...rows.map((row) => row.requests), 1)
  return rows.map((row) => ({ ...row, share: (row.requests / max) * 100 }))
}

type ShareRow = ReturnType<typeof withShare>[number]

function nameColumn(header: string): TableColumn<ShareRow> {
  return { id: 'name', header, width: 'minmax(0,3fr)', isPrimary: true, cell: (row) => <span className="block truncate font-medium">{row.key}</span> }
}

const messageColumn: TableColumn<ShareRow> = {
  id: 'messages',
  header: 'Messages',
  width: 'minmax(0,2fr)',
  cell: (row) => (
    <>
      <span className="tabular-nums">{formatCount(row.requests)}</span>
      <span aria-hidden="true" className="mt-1.5 block h-1.5 rounded-[1px] bg-accent" style={{ width: `${row.share}%` }} />
    </>
  ),
}

const tokenColumns: TableColumn<ShareRow>[] = [
  { id: 'in', header: 'Input tokens', width: '120px', align: 'numeric', cell: (row) => formatCompact(row.inputTokens) },
  { id: 'out', header: 'Output tokens', width: '120px', align: 'numeric', cell: (row) => formatCompact(row.outputTokens) },
]

export function UsageByTable({ label, nameHeader, rows }: { label: string; nameHeader: string; rows: UsageRow[] }) {
  return (
    <Table
      ariaLabel={label}
      columns={[nameColumn(nameHeader), messageColumn, ...tokenColumns]}
      rows={withShare(rows)}
      getRowId={(row) => row.key}
      empty={<p className="rounded-lg border border-edge bg-surface p-4 text-ink-3">No usage in this range.</p>}
    />
  )
}

const DAY_COLUMNS: TableColumn<UsageRow>[] = [
  { id: 'day', header: 'Day', isPrimary: true, cell: (row) => formatDayLabel(row.key) },
  { id: 'messages', header: 'Messages', align: 'numeric', cell: (row) => formatCount(row.requests) },
]

export function UsageDayTable({ rows }: { rows: UsageRow[] }) {
  return <Table ariaLabel="Messages per day" columns={DAY_COLUMNS} rows={rows} getRowId={(row) => row.key} />
}
