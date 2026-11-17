import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CaretRight, FileText } from '@phosphor-icons/react'
import { useBootstrap } from '../api/bootstrap'
import type { Template } from '../api/types'
import { ALL_CATEGORIES, templatesInCategory, visibleCategories } from '../chat/template-categories'
import { PageStatus } from '../components/chat/PageStatus'
import { ErrorText, LoadingText } from '../components/chat/StatusText'
import { EmptyState, Tabs } from '../components/ui'
import { useTopbar } from '../layout/topbar-context'

// Gallery of starting points. Choosing one opens a new chat with the template and its starter prompt in the composer.
export function TemplatesPage() {
  const bootstrap = useBootstrap()
  const navigate = useNavigate()
  const [category, setCategory] = useState<string>(ALL_CATEGORIES)
  useTopbar('Templates')

  if (bootstrap.isPending) return <PageStatus><LoadingText /></PageStatus>
  if (bootstrap.isError) return <PageStatus><ErrorText error={bootstrap.error} /></PageStatus>
  const { templates, settings } = bootstrap.data
  const categories = visibleCategories(settings.templateCategories, templates)
  const choose = (template: Template) => navigate(`/home?template=${encodeURIComponent(template.templateId)}`)

  return (
    <section aria-labelledby="templates-heading">
      <h1 id="templates-heading" tabIndex={-1} className="text-h1 font-semibold leading-[var(--text-h1--line-height)]">Templates</h1>
      <p className="mb-5 mt-1 text-ink-2">Start from a proven prompt. Pick one, fill in the brackets, and send.</p>
      {templates.length === 0 ? (
        <EmptyState icon={<FileText />} title="No templates yet">
          An administrator has not added any templates. You can still start a chat from scratch.
        </EmptyState>
      ) : (
        <Tabs
          ariaLabel="Template categories"
          selectedKey={category}
          onSelectionChange={(key) => setCategory(String(key))}
          tabs={categories.map((name) => ({
            id: name,
            label: name,
            content: <TemplateGrid templates={templatesInCategory(templates, name)} onChoose={choose} />,
          }))}
        />
      )}
    </section>
  )
}

function TemplateGrid({ templates, onChoose }: { templates: Template[]; onChoose: (template: Template) => void }) {
  return (
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3">
      {templates.map((template) => (
        <li key={template.templateId} className="grid">
          <button
            type="button"
            onClick={() => onChoose(template)}
            className="group grid content-start gap-1.5 rounded-lg border border-edge-strong bg-surface p-4 text-left transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-hover active:scale-[.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span className="flex items-center justify-between gap-2 text-body font-semibold">
              {template.title}
              <CaretRight size={16} aria-hidden="true" className="text-ink-3 transition-transform duration-[var(--duration-base)] group-hover:translate-x-[3px] group-hover:text-accent" />
            </span>
            <span className="text-ink-2">{template.description}</span>
            <span className="text-caption text-ink-3">{template.category}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
