import { describe, expect, it } from 'vitest'
import { CHECK_LABEL, CHECK_PROMPT, GENERIC_CUE, REFINEMENTS, findCues, hasFollowedUp, helperTarget, verifyLine } from './answer-helpers'
import { createAssistantMessage, createUserMessage, type UiMessage } from './messages'

function answer(content: string, status: UiMessage['status'] = 'complete'): UiMessage {
  return { ...createAssistantMessage('m'), content, status }
}

describe('follow-up text', () => {
  it('sends one plain sentence per refinement', () => {
    expect(REFINEMENTS.map((r) => r.prompt)).toContain('Make it shorter.')
    for (const refinement of REFINEMENTS) expect(refinement.prompt.split('. ').length).toBeLessThanOrEqual(2)
  })

  it('asks what might be wrong and names what to verify', () => {
    expect(CHECK_PROMPT).toMatch(/might be wrong or out of date/)
    for (const word of ['names', 'numbers', 'dates', 'references', 'where to check']) expect(CHECK_PROMPT).toContain(word)
  })

  it('reads as the person talking, in two short sentences or fewer', () => {
    expect(CHECK_PROMPT.split(/(?<=[.?])\s/).length).toBeLessThanOrEqual(2)
    expect(CHECK_PROMPT).not.toMatch(/\bI am an? |\bas an AI\b/i)
    expect(CHECK_LABEL).toBe('What should I double-check?')
  })
})

describe('verification cues', () => {
  it('names dates, numbers and laws found in the answer', () => {
    expect(findCues('The fee is $45 and is due by March 3. See Section 12.').map((c) => c.kind)).toEqual(['dates', 'numbers', 'laws'])
  })

  it('does not treat list numbers, source markers or code as facts', () => {
    expect(findCues('1. First step [1]\n2. Second step [2]\n\n```\nx = 100\n```')).toEqual([])
  })

  it('does not count a year as a number', () => {
    expect(findCues('It began in 2019.').map((c) => c.kind)).toEqual(['dates'])
  })

  it('falls back to the generic line, and names the kinds otherwise', () => {
    expect(verifyLine('Here is a friendly hello.')).toBe(GENERIC_CUE)
    expect(verifyLine('You have 12 weeks of leave from March 3.')).toBe('This answer includes dates and numbers. Check them against the source before you use them.')
    expect(verifyLine('It costs $5.', 'many')).toMatch(/^These answers include numbers/)
  })
})

describe('helperTarget', () => {
  it('is the last finished answer', () => {
    const messages = [createUserMessage('hi'), answer('Hello there.')]
    expect(helperTarget(messages, false)?.content).toBe('Hello there.')
  })

  it('hides while streaming, after an error, when stopped or when empty', () => {
    const user = createUserMessage('hi')
    expect(helperTarget([user, answer('Hello')], true)).toBeUndefined()
    expect(helperTarget([user, answer('Hello', 'error')], false)).toBeUndefined()
    expect(helperTarget([user, answer('Hel', 'stopped')], false)).toBeUndefined()
    expect(helperTarget([user, answer('  ')], false)).toBeUndefined()
    expect(helperTarget([user], false)).toBeUndefined()
  })

  it('knows when the person has already followed up', () => {
    const user = createUserMessage('hi')
    expect(hasFollowedUp([user, answer('a')])).toBe(false)
    expect(hasFollowedUp([user, answer('a'), createUserMessage('more')])).toBe(true)
  })
})
