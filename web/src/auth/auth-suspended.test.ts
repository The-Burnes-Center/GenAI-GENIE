import { describe, expect, it } from 'vitest'
import { isUserDisabledError } from './auth-errors'

describe('isUserDisabledError', () => {
  it('maps the Cognito disabled message', () => {
    const e = new Error('User is disabled.'); e.name = 'NotAuthorizedException'
    expect(isUserDisabledError(e)).toBe(true)
    const w = new Error('Incorrect username or password.'); w.name = 'NotAuthorizedException'
    expect(isUserDisabledError(w)).toBe(false)
  })
})
