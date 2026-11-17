import { describe, expect, it } from 'vitest'
import { domainMessage, isDomainAllowed, isPasswordValid } from './password-rules'
import { safeReturnPath } from './return-path'

describe('auth rules', () => {
  it('validates passwords', () => {
    expect(isPasswordValid('abc')).toBe(false)
    expect(isPasswordValid('Abcdefg1')).toBe(true)
  })
  it('checks domains and words the message', () => {
    expect(isDomainAllowed('a@example.org', ['example.org'])).toBe(true)
    expect(isDomainAllowed('a@gmail.com', ['example.org'])).toBe(false)
    expect(isDomainAllowed('a@gmail.com', [])).toBe(true)
    expect(domainMessage(['example.org', 'example.gov'])).toContain('@example.org or @example.gov')
  })
  it('only returns in-app paths', () => {
    expect(safeReturnPath({ from: '/chat/1' })).toBe('/chat/1')
    expect(safeReturnPath({ from: '//evil.com' })).toBe('/home')
    expect(safeReturnPath(null)).toBe('/home')
  })
})
