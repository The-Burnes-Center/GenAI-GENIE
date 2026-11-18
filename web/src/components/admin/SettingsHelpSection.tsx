import { TextField } from '../ui'
import { LinksEditor } from './LinksEditor'
import { RulesEditor } from './RulesEditor'
import { SectionTitle } from './PageHead'
import { HELP_LIMITS } from './settings-validation'
import type { SectionProps } from './SettingsWelcomeSection'

// Everything that helps people who are new to AI: base instructions, safety rules, links and a contact.
export function SettingsHelpSection({ draft, errors, setField }: SectionProps) {
  const used = draft.assistantInstructions.length
  return (
    <section aria-labelledby="set-help" className="grid gap-5">
      <SectionTitle id="set-help">Help and learning</SectionTitle>
      <div data-field="assistantInstructions">
        <TextField
          label="Instructions for Genie"
          multiline
          rows={7}
          value={draft.assistantInstructions}
          onChange={(value) => setField('assistantInstructions', value)}
          description={`Sent to the model with every chat, before any template’s own instructions. Use it for your agency’s tone and rules. ${used} of ${HELP_LIMITS.instructions} characters.`}
          errorMessage={errors.assistantInstructions}
        />
      </div>
      <RulesEditor value={draft.dataRules} onChange={(next) => setField('dataRules', next)} errors={errors} />
      <LinksEditor value={draft.learnLinks} onChange={(next) => setField('learnLinks', next)} errors={errors} />
      <div data-field="helpContact">
        <TextField
          label="Who to contact for help"
          type="text"
          value={draft.helpContact}
          onChange={(value) => setField('helpContact', value)}
          description="An email address or a web address that starts with https://. Shown on the Learn page. Leave empty to hide it."
          errorMessage={errors.helpContact}
        />
      </div>
    </section>
  )
}
