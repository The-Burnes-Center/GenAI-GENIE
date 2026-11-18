import { describe, expect, it } from 'vitest'
import { initialTemplates } from '../mock/seed-catalog'
import { HOME_STARTER_COUNT, STARTER_TASKS, resolveStarter, resolveStarterParam } from './starter-tasks'

describe('starter tasks', () => {
  it('has about six on home and every one has a blank to fill in', () => {
    expect(HOME_STARTER_COUNT).toBe(6)
    for (const task of STARTER_TASKS) expect(task.prompt).toMatch(/\[[^\]]+\]/)
  })

  it('uses an enabled matching template, with its hidden instructions', () => {
    const task = STARTER_TASKS.find((t) => t.id === 'meeting-agenda')!
    const resolved = resolveStarter(task, initialTemplates())
    expect(resolved.template?.templateId).toBe('t4')
    expect(resolved.prompt).toBe(initialTemplates()[3].starterPrompt)
  })

  it('falls back to the built-in prompt when no template matches or it is disabled', () => {
    const task = STARTER_TASKS.find((t) => t.id === 'reply-resident')!
    expect(resolveStarter(task, initialTemplates()).template).toBeUndefined()
    const off = initialTemplates().map((t) => ({ ...t, enabled: false }))
    expect(resolveStarter(STARTER_TASKS[0], off).prompt).toBe(STARTER_TASKS[0].prompt)
  })

  it('resolves the Learn page ?starter ids, and ignores unknown ones', () => {
    expect(resolveStarterParam('habit-format', [])?.prompt).toMatch(/3 bullet points/)
    expect(resolveStarterParam('nope', [])).toBeUndefined()
    expect(resolveStarterParam(null, [])).toBeUndefined()
  })
})
