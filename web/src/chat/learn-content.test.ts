import { describe, expect, it } from 'vitest'
import { HABITS, helpLink } from './learn-content'
import { resolveStarterParam } from './starter-tasks'

describe('helpLink', () => {
  it('hides when empty or not an email or https link', () => {
    expect(helpLink('')).toBeNull()
    expect(helpLink('  ')).toBeNull()
    expect(helpLink('http://insecure.example.org')).toBeNull()
    expect(helpLink('javascript:alert(1)')).toBeNull()
    expect(helpLink('a@b.c')).toBeNull()
    expect(helpLink('a@b.org?subject=hi&bcc=x@y.org')).toBeNull()
    expect(helpLink('a b@example.org')).toBeNull()
  })

  it('makes an email a mailto link and an https URL an external link', () => {
    expect(helpLink('help@example.org')).toEqual({ href: 'mailto:help%40example.org', label: 'help@example.org', isExternal: false })
    expect(helpLink('https://help.example.org/ask')).toMatchObject({ isExternal: true, href: 'https://help.example.org/ask' })
  })
})

describe('habits', () => {
  it('every "Try it" opens a filled example', () => {
    for (const habit of HABITS) expect(resolveStarterParam(habit.exampleId, [])?.prompt).toBeTruthy()
  })
})
