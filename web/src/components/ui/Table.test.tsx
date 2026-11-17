import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, type TableColumn } from './Table'

interface Row { id: string; name: string; role: string }
const columns: TableColumn<Row>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name, isPrimary: true },
  { id: 'role', header: 'Role', cell: (r) => r.role },
  { id: 'actions', header: '', cell: () => <button>Edit</button>, isActions: true },
]
const rows: Row[] = [{ id: '1', name: 'Ada', role: 'Admin' }]

describe('Table', () => {
  it('keeps table roles and labels non-primary cells for stacking', () => {
    render(<Table ariaLabel="People" columns={columns} rows={rows} getRowId={(r) => r.id} />)
    expect(screen.getByRole('table', { name: 'People' })).toBeTruthy()
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')
    expect(cells[0]!.getAttribute('data-label')).toBeNull()
    expect(cells[1]!.getAttribute('data-label')).toBe('Role')
    expect(cells[2]!.getAttribute('data-label')).toBeNull()
  })
  it('gives the actions header hidden text and renders the empty state', () => {
    const { rerender } = render(<Table ariaLabel="People" columns={columns} rows={rows} getRowId={(r) => r.id} />)
    expect(screen.getByText('Actions')).toBeTruthy()
    rerender(<Table ariaLabel="People" columns={columns} rows={[]} getRowId={(r) => r.id} empty={<p>No one yet</p>} />)
    expect(screen.getByText('No one yet')).toBeTruthy()
  })
})
