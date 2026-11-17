import { useState } from 'react'
import { Plus, Robot } from '@phosphor-icons/react'
import { useAdminModels } from '../../api/admin-models'
import type { ModelConfig } from '../../api/types'
import { AddModelDialog } from '../../components/admin/AddModelDialog'
import { ModelEditDialog } from '../../components/admin/ModelEditDialog'
import { ModelsTable } from '../../components/admin/ModelsTable'
import { PageHead } from '../../components/admin/PageHead'
import { QueryError, TableSkeleton } from '../../components/admin/states'
import { useConfirm } from '../../components/admin/use-confirm'
import { useModelActions } from '../../components/admin/use-model-actions'
import { Button, EmptyState } from '../../components/ui'

export function AdminModelsPage() {
  const models = useAdminModels()
  const { ask, dialog } = useConfirm()
  const items = models.data?.items ?? []
  const actions = useModelActions(items, ask)
  const [isAdding, setIsAdding] = useState(false)
  const [editing, setEditing] = useState<ModelConfig | null>(null)
  const nextSortOrder = items.reduce((highest, model) => Math.max(highest, model.sortOrder), 0) + 1

  return (
    <>
      <PageHead
        title="Models"
        lead="Choose which AI models staff can use, test that they respond, and add new ones from AWS Bedrock."
        actions={
          <Button variant="primary" onPress={() => setIsAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            Add a model
          </Button>
        }
      />
      {(models.isPending || actions.settings.isPending) && <TableSkeleton label="Loading models" rows={5} />}
      {models.isError && <QueryError what="models" error={models.error} onRetry={() => void models.refetch()} />}
      {actions.settings.isError && <QueryError what="the default model" error={actions.settings.error} onRetry={() => void actions.settings.refetch()} />}
      {models.isSuccess && actions.settings.isSuccess && items.length === 0 && (
        <EmptyState icon={<Robot />} title="No models yet" action={<Button variant="primary" onPress={() => setIsAdding(true)}>Add a model</Button>}>
          Add one from the models available in your AWS account.
        </EmptyState>
      )}
      {models.isSuccess && actions.settings.isSuccess && items.length > 0 && (
        <>
          <ModelsTable
            models={items}
            defaultModelId={actions.defaultModelId}
            tests={actions.tests}
            onToggle={actions.toggle}
            onDefault={actions.makeDefault}
            onTest={(model) => void actions.runTest(model)}
            onEdit={setEditing}
            onRemove={actions.askRemove}
          />
          <p className="mt-3 text-small text-ink-3">
            Turning a model off hides it from everyone. The default model can't be turned off or removed. Numbers show how much text a model can read and write at once (tokens).
          </p>
        </>
      )}
      <AddModelDialog isOpen={isAdding} onOpenChange={setIsAdding} available={models.data?.available ?? []} nextSortOrder={nextSortOrder} />
      <ModelEditDialog model={editing} onOpenChange={(open) => !open && setEditing(null)} />
      {dialog}
    </>
  )
}
