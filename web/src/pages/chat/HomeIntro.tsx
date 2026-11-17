import { Link } from 'react-router'
import type { Template } from '../../api/types'
import { Button, buttonClass } from '../../components/ui'

interface HomeIntroProps {
  title: string
  message: string
}

// Welcome title and message from settings, above the hero composer.
export function HomeIntro({ title, message }: HomeIntroProps) {
  return (
    <div className="mb-5">
      <h1 id="home-title" tabIndex={-1} className="text-[length:var(--text-display)] font-semibold leading-[var(--text-display--line-height)] tracking-[var(--text-display--letter-spacing)] max-[479px]:text-[1.75rem] max-[479px]:leading-[2.125rem]">
        {title}
      </h1>
      <p className="mt-2 max-w-[56ch] text-title leading-relaxed text-ink-2">{message}</p>
    </div>
  )
}

interface SuggestionsProps {
  templates: Template[]
  onPick: (template: Template) => void
}

const SUGGESTION_COUNT = 4

// Template chips under the composer. Picking one fills the composer, it never sends.
export function TemplateSuggestions({ templates, onPick }: SuggestionsProps) {
  const shown = [...templates].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, SUGGESTION_COUNT)
  if (shown.length === 0) return null
  return (
    <div role="group" aria-label="Start from a template" className="mt-2 flex flex-wrap items-center gap-2">
      {shown.map((template) => (
        <Button key={template.templateId} variant="secondary" className="bg-transparent! font-normal" onPress={() => onPick(template)}>
          {template.title}
        </Button>
      ))}
      <Link to="/templates" className={buttonClass('link', 'md', false, 'ml-1.5')}>
        More templates
      </Link>
    </div>
  )
}
