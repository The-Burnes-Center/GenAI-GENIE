import { Plus } from '@phosphor-icons/react'
import type { LearnLink } from '../../api/types'
import { Button, TextField } from '../ui'
import { ListRowControls } from './ListRowControls'
import { HELP_LIMITS, type SettingsErrors } from './settings-validation'
import { useStableRows } from './use-stable-rows'

interface LinksEditorProps {
  value: LearnLink[]
  onChange: (next: LearnLink[]) => void
  errors: SettingsErrors
}

// Training and help links for the Learn page: a title, an https address and an optional line about it.
export function LinksEditor({ value, onChange, errors }: LinksEditorProps) {
  const [list, containerRef] = useStableRows<LearnLink>(value, onChange, () => ({ title: '', url: '' }))
  return (
    <div ref={containerRef} className="grid gap-2" role="group" aria-labelledby="links-label" data-field="learnLinks">
      <span id="links-label" className="font-medium">Learning links</span>
      <p className="text-small text-ink-3">Courses and guides on the Learn page. They open in a new tab. Up to {HELP_LIMITS.links}.</p>
      <ul className="grid list-none gap-3">
        {list.rows.map(({ item: link, index, id }) => (
          <li key={id} data-row-id={id} className="grid gap-3 rounded-lg border border-edge bg-surface p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Link {index + 1}</h3>
              <ListRowControls name={`link ${index + 1}`} index={index} count={value.length} onMove={list.move} onRemove={list.remove} />
            </div>
            <div data-field={`learnLinks.${index}.title`}>
              <TextField label="Title" value={link.title} onChange={(title) => list.edit(index, { ...link, title })} errorMessage={errors[`learnLinks.${index}.title`]} />
            </div>
            <div data-field={`learnLinks.${index}.url`}>
              <TextField label="Web address" type="url" placeholder="https://" value={link.url} onChange={(url) => list.edit(index, { ...link, url })} errorMessage={errors[`learnLinks.${index}.url`]} />
            </div>
            <div data-field={`learnLinks.${index}.description`}>
              <TextField label="Description (optional)" value={link.description ?? ''} onChange={(description) => list.edit(index, { ...link, description })} errorMessage={errors[`learnLinks.${index}.description`]} />
            </div>
          </li>
        ))}
      </ul>
      {errors.learnLinks && <p role="alert" className="text-small text-danger">{errors.learnLinks}</p>}
      <div>
        <Button data-add="" isDisabled={value.length >= HELP_LIMITS.links} onPress={list.add}>
          <Plus size={16} aria-hidden="true" />
          Add a link
        </Button>
      </div>
    </div>
  )
}
