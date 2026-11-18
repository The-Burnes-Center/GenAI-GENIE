import { useRef, useState, type FormEvent } from 'react'
import { describeError } from '../../api/errors'
import { useSaveAdminSettings } from '../../api/admin-content'
import type { ModelConfig, Settings } from '../../api/types'
import { Button, InlineNotice, toast } from '../ui'
import { CategoriesEditor } from './CategoriesEditor'
import { SettingsHelpSection } from './SettingsHelpSection'
import { SettingsLimitsSection } from './SettingsLimitsSection'
import { SettingsSignupSection } from './SettingsSignupSection'
import { SettingsWelcomeSection, WelcomePreview } from './SettingsWelcomeSection'
import { firstInvalidField, validateSettings, type SettingsErrors } from './settings-validation'
import { useUnsavedGuard } from './use-unsaved-guard'

function sameSettings(a: Settings, b: Settings): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function SettingsForm({ settings, models }: { settings: Settings; models: ModelConfig[] }) {
  const save = useSaveAdminSettings()
  const formRef = useRef<HTMLFormElement>(null)
  const [baseline, setBaseline] = useState(settings)
  const [draft, setDraft] = useState(settings)
  const [errors, setErrors] = useState<SettingsErrors>({})
  const [resetCount, setResetCount] = useState(0)
  const isDirty = !sameSettings(draft, baseline)
  const { dialog } = useUnsavedGuard(isDirty)

  const setField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function focusField(field: string) {
    const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"] :is(input, textarea, button)`)
    target?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validateSettings(draft, models.map((model) => model.modelId))
    setErrors(found)
    const first = firstInvalidField(found)
    if (first) {
      focusField(first)
      return
    }
    save.mutate(draft, {
      onSuccess: (saved) => {
        setBaseline(saved)
        toast.show('Settings saved.')
      },
    })
  }

  function handleDiscard() {
    setDraft(baseline)
    setErrors({})
    save.reset()
    setResetCount((count) => count + 1)
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <div key={resetCount} className="grid max-w-[640px] gap-8">
        <SettingsWelcomeSection draft={draft} errors={errors} setField={setField} />
        <SettingsLimitsSection draft={draft} errors={errors} setField={setField} models={models} />
        <div data-field="templateCategories">
          <CategoriesEditor value={draft.templateCategories} onChange={(next) => setField('templateCategories', next)} error={errors.templateCategories} />
        </div>
        <SettingsHelpSection draft={draft} errors={errors} setField={setField} />
        <SettingsSignupSection draft={draft} errors={errors} setField={setField} />
      </div>
      <WelcomePreview draft={draft} />
      <div className="sticky bottom-0 z-10 col-span-full -mx-4 grid gap-2 border-t border-edge bg-canvas px-4 py-3 md:-mx-8 md:px-8">
        {save.isError && <InlineNotice tone="bad">{`Settings were not saved. ${describeError(save.error)}`}</InlineNotice>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isDirty && <span className="mr-auto text-small text-ink-3">You have unsaved changes.</span>}
          <Button isDisabled={!isDirty} onPress={handleDiscard}>Discard changes</Button>
          <Button type="submit" variant="primary" isPending={save.isPending} pendingLabel="Saving">Save settings</Button>
        </div>
      </div>
      {dialog}
    </form>
  )
}
