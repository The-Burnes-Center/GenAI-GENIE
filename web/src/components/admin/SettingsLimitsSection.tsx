import { useMemo } from 'react'
import type { ModelConfig } from '../../api/types'
import { Select, TextField } from '../ui'
import { SectionTitle } from './PageHead'
import type { SectionProps } from './SettingsWelcomeSection'

const NUMBER_WIDTH = 'max-w-[160px]'

function toText(value: number): string {
  return Number.isNaN(value) ? '' : String(value)
}

function toNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text)
}

function NumberField({ field, label, description, props }: {
  field: 'dailyMessageLimit' | 'maxCompareModels' | 'retrievalTopK'
  label: string
  description?: string
  props: SectionProps
}) {
  return (
    <div data-field={field}>
      <TextField
        className={NUMBER_WIDTH}
        label={label}
        description={description}
        type="number"
        inputMode="numeric"
        value={toText(props.draft[field])}
        onChange={(text) => props.setField(field, toNumber(text))}
        errorMessage={props.errors[field]}
      />
    </div>
  )
}

export function SettingsLimitsSection(props: SectionProps & { models: ModelConfig[] }) {
  const { draft, errors, setField, models } = props
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf('timeZone')
    return all.includes(draft.timezone) ? all : [draft.timezone, ...all]
  }, [draft.timezone])
  const options = (current: string) =>
    models.filter((m) => m.enabled || m.modelId === current).map((m) => ({ id: m.modelId, label: m.label }))

  return (
    <section aria-labelledby="set-limits" className="grid gap-4">
      <SectionTitle id="set-limits">Models and limits</SectionTitle>
      <div data-field="defaultModelId">
        <Select label="Default model" options={options(draft.defaultModelId)} selectedKey={draft.defaultModelId}
          onSelectionChange={(key) => key && setField('defaultModelId', String(key))} errorMessage={errors.defaultModelId} />
      </div>
      <div data-field="titleModelId">
        <Select label="Model that names chats" options={options(draft.titleModelId)} selectedKey={draft.titleModelId}
          description="A small, fast model works best. It writes a short title after the first answer."
          onSelectionChange={(key) => key && setField('titleModelId', String(key))} errorMessage={errors.titleModelId} />
      </div>
      <NumberField field="dailyMessageLimit" label="Daily messages per person" description="Enter 0 for no limit." props={props} />
      <NumberField field="maxCompareModels" label="Most models in a comparison" description="From 2 to 4." props={props} />
      <NumberField field="retrievalTopK" label="Sources read per question" props={props}
        description="How many passages Genie reads from a workspace to answer, from 1 to 20. More can be more complete, but slower." />
      <div data-field="timezone">
        <Select label="Time zone" options={zones.map((zone) => ({ id: zone, label: zone }))} selectedKey={draft.timezone}
          description="Daily limits reset at midnight in this time zone."
          onSelectionChange={(key) => key && setField('timezone', String(key))} errorMessage={errors.timezone} />
      </div>
    </section>
  )
}
