import { Checkbox, Select, TextField } from '../ui'
import { categoryOptions, type TemplateDraft, type TemplateDraftErrors } from './templates-helpers'

interface TemplateFieldsProps {
  draft: TemplateDraft
  errors: TemplateDraftErrors
  categories: string[]
  onChange: <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => void
}

export function TemplateFields({ draft, errors, categories, onChange }: TemplateFieldsProps) {
  return (
    <div className="grid gap-5">
      <TextField label="Title" value={draft.title} onChange={(value) => onChange('title', value)} errorMessage={errors.title} />
      <TextField label="Short description" description="Shown on the template card." value={draft.description} onChange={(value) => onChange('description', value)} />
      <Select
        label="Category"
        options={categoryOptions(categories, draft.category)}
        selectedKey={draft.category}
        onSelectionChange={(key) => onChange('category', String(key))}
        errorMessage={errors.category}
        description="Admins can change the list under Settings."
      />
      <TextField
        label="Instructions for the model"
        description="People don't see this. It tells the model how to behave for this template."
        multiline
        rows={5}
        value={draft.systemPrompt}
        onChange={(value) => onChange('systemPrompt', value)}
      />
      <TextField
        label="Starter message"
        description="Fills the message box. Put [brackets] around parts the person should replace."
        multiline
        rows={4}
        value={draft.starterPrompt}
        onChange={(value) => onChange('starterPrompt', value)}
      />
      <TextField
        label="Sort order"
        description="Lower numbers come first."
        inputMode="numeric"
        className="max-w-[140px]"
        value={draft.sortOrder}
        onChange={(value) => onChange('sortOrder', value)}
        errorMessage={errors.sortOrder}
      />
      <Checkbox isSelected={draft.enabled} onChange={(value) => onChange('enabled', value)}>Show this template to staff</Checkbox>
    </div>
  )
}

export function TemplatePreview({ draft }: { draft: TemplateDraft }) {
  return (
    <aside aria-label="Preview" className="grid content-start gap-1.5 rounded-lg border border-edge bg-surface p-4">
      <p className="text-caption font-semibold text-ink-3">PREVIEW</p>
      <p className="font-semibold">{draft.title || 'Template title'}</p>
      <p className="text-ink-2">{draft.description || 'Short description'}</p>
      <span className="mt-1 justify-self-start rounded-xs bg-sunken px-2 text-caption font-medium text-ink-2">{draft.category}</span>
    </aside>
  )
}
