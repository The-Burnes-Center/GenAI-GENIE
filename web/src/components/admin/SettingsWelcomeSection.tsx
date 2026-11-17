import type { Settings } from '../../api/types'
import { TextField } from '../ui'
import { SectionTitle } from './PageHead'
import type { SettingsErrors } from './settings-validation'

export interface SectionProps {
  draft: Settings
  errors: SettingsErrors
  setField: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

export function SettingsWelcomeSection({ draft, errors, setField }: SectionProps) {
  return (
    <section aria-labelledby="set-welcome" className="grid gap-4">
      <SectionTitle id="set-welcome">Welcome</SectionTitle>
      <div data-field="appName">
        <TextField label="App name" value={draft.appName} onChange={(v) => setField('appName', v)} errorMessage={errors.appName} />
      </div>
      <div data-field="welcomeTitle">
        <TextField label="Welcome title" value={draft.welcomeTitle} onChange={(v) => setField('welcomeTitle', v)} errorMessage={errors.welcomeTitle} />
      </div>
      <TextField label="Welcome message" multiline rows={3} value={draft.welcomeMessage} onChange={(v) => setField('welcomeMessage', v)} />
      <TextField
        label="Disclaimer"
        multiline
        rows={2}
        value={draft.disclaimer}
        onChange={(v) => setField('disclaimer', v)}
        description="Shown under the message box. Leave empty to hide it."
      />
    </section>
  )
}

// Live preview of the home screen text, so admins see the effect before saving.
export function WelcomePreview({ draft }: { draft: Settings }) {
  return (
    <aside aria-label="Preview of the welcome screen" className="grid gap-1.5 rounded-lg border border-edge bg-surface p-4 xl:sticky xl:top-6">
      <p className="text-caption font-semibold text-ink-3">PREVIEW OF THE HOME SCREEN</p>
      <p className="text-h2 font-semibold">{draft.welcomeTitle}</p>
      <p className="text-ink-2">{draft.welcomeMessage}</p>
      {draft.disclaimer && <p className="text-small text-ink-3">{draft.disclaimer}</p>}
    </aside>
  )
}
