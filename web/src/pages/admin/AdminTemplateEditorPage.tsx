import { useMemo, useRef, useState, type FormEvent } from 'react'
import { FileDashed, Trash } from '@phosphor-icons/react'
import { useNavigate, useParams } from 'react-router'
import { useAdminSettings, useAdminTemplates, useDeleteTemplate, useUpsertTemplate } from '../../api/admin-content'
import { describeError } from '../../api/errors'
import type { Template } from '../../api/types'
import { RouterLinkButton } from '../../components/admin/RouterLinkButton'
import { PageHead } from '../../components/admin/PageHead'
import { TemplateFields, TemplatePreview } from '../../components/admin/TemplateFields'
import { QueryError, TableSkeleton } from '../../components/admin/states'
import {
  draftFromTemplate, emptyDraft, newTemplateId, templateFromDraft, validateTemplate,
  type TemplateDraft, type TemplateDraftErrors,
} from '../../components/admin/templates-helpers'
import { useConfirm } from '../../components/admin/use-confirm'
import { Button, EmptyState, InlineNotice, toast } from '../../components/ui'

const LIST_PATH = '/admin/templates'

export function AdminTemplateEditorPage() {
  const { id } = useParams()
  const templates = useAdminTemplates()
  const settings = useAdminSettings()
  if (templates.isPending || settings.isPending) return <TableSkeleton label="Loading template" rows={3} />
  if (templates.isError) return <QueryError what="the template" error={templates.error} onRetry={() => void templates.refetch()} />
  if (settings.isError) return <QueryError what="the categories" error={settings.error} onRetry={() => void settings.refetch()} />

  const existing = id ? templates.data.find((item) => item.templateId === id) : undefined
  if (id && !existing) {
    return (
      <EmptyState icon={<FileDashed />} title="We can't find that template" action={<RouterLinkButton to={LIST_PATH}>All templates</RouterLinkButton>}>
        It may have been deleted.
      </EmptyState>
    )
  }
  const nextOrder = templates.data.reduce((highest, item) => Math.max(highest, item.sortOrder), 0) + 1
  const first = settings.data.templateCategories[0] ?? ''
  return <EditorForm existing={existing} categories={settings.data.templateCategories} initial={existing ? draftFromTemplate(existing) : emptyDraft(first, nextOrder)} />
}

function EditorForm({ existing, categories, initial }: { existing: Template | undefined; categories: string[]; initial: TemplateDraft }) {
  const navigate = useNavigate()
  const upsert = useUpsertTemplate()
  const remove = useDeleteTemplate()
  const { ask, dialog } = useConfirm()
  const formRef = useRef<HTMLFormElement>(null)
  const templateId = useMemo(() => existing?.templateId ?? newTemplateId(), [existing])
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<TemplateDraftErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const setField = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validateTemplate(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setServerError(null)
    upsert.mutate(templateFromDraft(templateId, draft), {
      onSuccess: () => {
        toast.show('Template saved.')
        navigate(LIST_PATH)
      },
      onError: (error) => setServerError(describeError(error)),
    })
  }

  const askDelete = () =>
    ask({
      title: 'Delete this template?',
      body: `"${draft.title}" will disappear for everyone. This can't be undone.`,
      confirmLabel: 'Delete template',
      onConfirm: async () => {
        await remove.mutateAsync(templateId)
        toast.show('Template deleted.')
        navigate(LIST_PATH)
      },
    })

  return (
    <>
      <PageHead title={existing ? 'Edit template' : 'New template'} back={{ to: LIST_PATH, label: 'All templates' }} />
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_300px] min-[1100px]:items-start">
        <TemplateFields draft={draft} errors={errors} categories={categories} onChange={setField} />
        <TemplatePreview draft={draft} />
        {serverError && <InlineNotice tone="bad" className="min-[1100px]:col-span-2">{serverError}</InlineNotice>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-edge pt-3 min-[1100px]:col-span-2">
          {existing && (
            <Button variant="danger" className="mr-auto" onPress={askDelete}>
              <Trash size={16} aria-hidden="true" />
              Delete
            </Button>
          )}
          <RouterLinkButton to={LIST_PATH}>Cancel</RouterLinkButton>
          <Button type="submit" variant="primary" isPending={upsert.isPending} pendingLabel="Saving">Save template</Button>
        </div>
      </form>
      {dialog}
    </>
  )
}
