import type { ReactNode } from 'react'
import { cx } from './cx'

export interface TableColumn<Row> {
  id: string
  header: string
  cell: (row: Row) => ReactNode
  // Grid track for this column on wide screens, for example '2fr', '120px' or 'minmax(0,1fr)'. Default '1fr'.
  width?: string
  align?: 'start' | 'end' | 'numeric'
  // Action columns have no visible header (a visually hidden "Actions" is used) and stay unlabeled when stacked.
  isActions?: boolean
  // The first column is the row title when stacked: shown without a label.
  isPrimary?: boolean
}

interface TableProps<Row> {
  ariaLabel: string
  columns: TableColumn<Row>[]
  rows: Row[]
  getRowId: (row: Row) => string
  // Shown instead of the table when there are no rows.
  empty?: ReactNode
  className?: string
}

// Under 640 px each row becomes a labeled stack (every cell gets its column name). The ARIA table roles
// stay on the elements the whole time, so assistive technology still reads a table.
export function Table<Row>({ ariaLabel, columns, rows, getRowId, empty, className }: TableProps<Row>) {
  if (rows.length === 0 && empty) return <>{empty}</>
  const template = columns.map((column) => column.width ?? '1fr').join(' ')
  return (
    <div role="table" aria-label={ariaLabel} className={cx('overflow-hidden rounded-lg border border-edge bg-surface', className)} style={{ '--cols': template } as React.CSSProperties}>
      <div role="rowgroup" className="max-sm:vh">
        <div role="row" className="grid grid-cols-[var(--cols)] items-center gap-3 border-b border-edge bg-sunken px-4 py-2 text-caption font-semibold text-ink-2">
          {columns.map((column) => (
            <div key={column.id} role="columnheader" className={cellAlign(column.align)}>
              {column.isActions ? <span className="vh">{column.header || 'Actions'}</span> : column.header}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup">
        {rows.map((row) => (
          <div
            key={getRowId(row)}
            role="row"
            className="grid min-h-14 grid-cols-[var(--cols)] items-center gap-3 border-b border-edge px-4 py-2.5 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1 max-sm:py-3.5"
          >
            {columns.map((column) => (
              <div
                key={column.id}
                role="cell"
                data-label={column.isPrimary || column.isActions ? undefined : column.header}
                className={cx(
                  'min-w-0 max-sm:text-left',
                  cellAlign(column.align),
                  column.isActions && 'flex flex-wrap items-center justify-end gap-1 max-sm:mt-1 max-sm:justify-start',
                  'max-sm:data-[label]:before:mr-1 max-sm:data-[label]:before:text-small max-sm:data-[label]:before:text-ink-3 max-sm:data-[label]:before:content-[attr(data-label)":"]',
                )}
              >
                {column.cell(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function cellAlign(align: TableColumn<unknown>['align']): string {
  if (align === 'end') return 'text-right'
  if (align === 'numeric') return 'text-right tabular-nums'
  return ''
}

// Two-line cell helper used by most tables: a title and a quiet second line.
export function CellText({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <span className="block truncate font-medium">{title}</span>
      {sub && <span className="block truncate text-small text-ink-3">{sub}</span>}
    </>
  )
}
