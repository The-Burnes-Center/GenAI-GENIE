import { useState } from 'react'
import type { SignupMode } from '../../api/types'
import { Checkbox, RadioGroup, TextField } from '../ui'
import { SectionTitle } from './PageHead'
import type { SectionProps } from './SettingsWelcomeSection'
import { parseDomains } from './settings-validation'

const MODES = [
  { value: 'off', label: 'Invitation only', description: 'Only people you invite can sign in. The sign-up page says it is closed.' },
  { value: 'open', label: 'Anyone with an allowed email', description: 'People create their own accounts with a work email.' },
]

export function SettingsSignupSection({ draft, errors, setField }: SectionProps) {
  // Raw text is kept while typing so commas and spaces are not eaten by the parser.
  const [text, setText] = useState(draft.allowedEmailDomains.join(', '))
  return (
    <section aria-labelledby="set-signup" className="grid gap-4">
      <SectionTitle id="set-signup">Sign-up</SectionTitle>
      <RadioGroup label="Who can create an account" options={MODES} value={draft.signupMode}
        onChange={(value) => setField('signupMode', value as SignupMode)} />
      <div data-field="allowedEmailDomains">
        <TextField
          label="Allowed email domains"
          placeholder="example.org, example.gov"
          description="Separate with commas. Leave empty to allow any email address."
          isDisabled={draft.signupMode === 'off'}
          value={text}
          onChange={(value) => { setText(value); setField('allowedEmailDomains', parseDomains(value)) }}
          errorMessage={errors.allowedEmailDomains}
        />
      </div>
      <Checkbox isSelected={draft.requireApproval} onChange={(value) => setField('requireApproval', value)}>
        <span className="block">Require an administrator to approve new sign-ups</span>
        <span className="block text-small text-ink-3">Waiting people appear on the Users page.</span>
      </Checkbox>
    </section>
  )
}
