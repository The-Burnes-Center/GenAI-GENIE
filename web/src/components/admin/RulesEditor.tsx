import { Plus } from '@phosphor-icons/react'
import { Button, TextField } from '../ui'
import { ListRowControls } from './ListRowControls'
import { HELP_LIMITS, type SettingsErrors } from './settings-validation'
import { useStableRows } from './use-stable-rows'

interface RulesEditorProps {
  value: string[]
  onChange: (next: string[]) => void
  errors: SettingsErrors
}

// "What not to share": one short rule per row, in the order staff will read them.
export function RulesEditor({ value, onChange, errors }: RulesEditorProps) {
  const [list, containerRef] = useStableRows(value, onChange, () => '')
  return (
    <div ref={containerRef} className="grid gap-2" role="group" aria-labelledby="rules-label" data-field="dataRules">
      <span id="rules-label" className="font-medium">What not to share</span>
      <p className="text-small text-ink-3">Short rules shown to staff on their first visit and on the Learn page. Up to {HELP_LIMITS.rules}, {HELP_LIMITS.rule} characters each.</p>
      <ul className="grid list-none gap-2">
        {list.rows.map(({ item, index, id }) => (
          <li key={id} data-row-id={id} className="flex items-start gap-1" data-field={`dataRules.${index}`}>
            <TextField className="min-w-0 flex-1" label={`Rule ${index + 1}`} value={item} onChange={(text) => list.edit(index, text)} errorMessage={errors[`dataRules.${index}`]} />
            <div className="pt-[26px]">
              <ListRowControls name={`rule ${index + 1}`} index={index} count={value.length} onMove={list.move} onRemove={list.remove} />
            </div>
          </li>
        ))}
      </ul>
      {errors.dataRules && <p role="alert" className="text-small text-danger">{errors.dataRules}</p>}
      <div>
        <Button data-add="" isDisabled={value.length >= HELP_LIMITS.rules} onPress={list.add}>
          <Plus size={16} aria-hidden="true" />
          Add a rule
        </Button>
      </div>
    </div>
  )
}
