import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from '@phosphor-icons/react'
import { Button, IconButton, TextField } from '../ui'

interface CategoriesEditorProps {
  value: string[]
  onChange: (next: string[]) => void
  error?: string
}

function move(list: string[], from: number, to: number): string[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as string)
  return next
}

// Ordered list of template categories with add, remove and reorder. The gallery tabs follow this order.
export function CategoriesEditor({ value, onChange, error }: CategoriesEditorProps) {
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | undefined>()

  function add() {
    const name = draft.trim()
    if (name === '') return
    if (value.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setAddError(`${name} is already in the list.`)
      return
    }
    setAddError(undefined)
    setDraft('')
    onChange([...value, name])
  }

  return (
    <div className="grid gap-2" role="group" aria-labelledby="categories-label">
      <span id="categories-label" className="font-medium">Template categories</span>
      <p className="text-small text-ink-3">Admins pick one of these when writing a template. They also become the tabs in the gallery.</p>
      <ul className="overflow-hidden rounded-md border border-edge-strong bg-surface">
        {value.map((name, index) => (
          <li key={name} className="flex items-center gap-1 border-b border-edge px-3 py-1 last:border-b-0">
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <IconButton size="sm" label={`Move ${name} up`} isDisabled={index === 0} onPress={() => onChange(move(value, index, index - 1))}>
              <ArrowUp size={16} aria-hidden="true" />
            </IconButton>
            <IconButton size="sm" label={`Move ${name} down`} isDisabled={index === value.length - 1} onPress={() => onChange(move(value, index, index + 1))}>
              <ArrowDown size={16} aria-hidden="true" />
            </IconButton>
            <IconButton size="sm" label={`Remove ${name}`} onPress={() => onChange(value.filter((_, at) => at !== index))}>
              <X size={16} aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <TextField
          className="min-w-0 flex-1"
          label="New category"
          value={draft}
          onChange={(next) => { setDraft(next); setAddError(undefined) }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
          errorMessage={addError}
          maxLength={40}
        />
        <Button onPress={add}><Plus size={16} aria-hidden="true" />Add</Button>
      </div>
      {error && <p role="alert" className="text-small text-danger">{error}</p>}
    </div>
  )
}
