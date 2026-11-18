import { describe, expect, it } from 'vitest'
import { isEmail, isHttpsUrl, mailtoHref } from './url-rules'

describe('url rules', () => {
  it('accepts https only', () => {
    expect(isHttpsUrl('https://example.org/a?b=1')).toBe(true)
    for (const bad of ['http://example.org', 'javascript:alert(1)', 'ftp://x.org', 'https://', 'example.org']) expect(isHttpsUrl(bad)).toBe(false)
  })

  it('matches the backend email rule: a TLD of two or more letters, no spaces or query characters', () => {
    expect(isEmail('help.desk@agency.example.org')).toBe(true)
    for (const bad of ['a@b.c', 'a@b', 'a b@c.org', 'a@b.org?x=1', 'a@b.org&c=d', 'a@b.org=']) expect(isEmail(bad)).toBe(false)
  })

  it('encodes the address for a mailto link', () => {
    expect(mailtoHref('a+b@example.org')).toBe('mailto:a%2Bb%40example.org')
  })
})
