import { FileText, Plus } from '@phosphor-icons/react'
import { useAdminTemplates, useUpsertTemplate } from '../../api/admin-content'
import { describeError } from '../../api/errors'
import type { Template } from '../../api/types'
import { PageHead } from '../../components/admin/PageHead'
import { RouterLinkButton } from '../../components/admin/RouterLinkButton'
import { QueryError, TableSkeleton } from '../../components/admin/states'
import { CellText, EmptyState, Switch, Table, toast, type TableColumn } from '../../components/ui'

export function AdminTemplatesPage() {
  const templates = useAdminTemplates()
  const upsert = useUpsertTemplate()

  const toggle = (template: Template) =>
    upsert.mutate({ ...template, enabled: !template.enabled }, { onError: (error) => toast.error(describeError(error)) })

  const columns: TableColumn<Template>[] = [
    { id: 'title', header: 'Template', width: 'minmax(0,2.4fr)', isPrimary: true, cell: (item) => <CellText title={item.title} sub={item.description} /> },
    { id: 'category', header: 'Category', width: '140px', cell: (item) => item.category },
    {
      id: 'shown',
      header: 'Shown',
      width: '80px',
      cell: (item) => (
        <Switch isLabelHidden isSelected={item.enabled} onChange={() => toggle(item)}>{`Show ${item.title} to staff`}</Switch>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      width: '90px',
      isActions: true,
      cell: (item) => <RouterLinkButton size="sm" to={`/admin/templates/${encodeURIComponent(item.templateId)}`} aria-label={`Edit ${item.title}`}>Edit</RouterLinkButton>,
    },
  ]

  return (
    <>
      <PageHead
        title="Templates"
        lead="Starting points staff see in the gallery."
        actions={
          <RouterLinkButton variant="primary" to="/admin/templates/new">
            <Plus size={16} aria-hidden="true" />
            New template
          </RouterLinkButton>
        }
      />
      {templates.isPending && <TableSkeleton label="Loading templates" />}
      {templates.isError && <QueryError what="templates" error={templates.error} onRetry={() => void templates.refetch()} />}
      {templates.isSuccess && (
        <Table
          ariaLabel="Templates"
          columns={columns}
          rows={templates.data}
          getRowId={(item) => item.templateId}
          empty={
            <EmptyState icon={<FileText />} title="No templates yet" action={<RouterLinkButton variant="primary" to="/admin/templates/new">New template</RouterLinkButton>}>
              Templates give staff a starting point in the gallery.
            </EmptyState>
          }
        />
      )}
    </>
  )
}
