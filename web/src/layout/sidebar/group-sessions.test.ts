import { describe, expect, it } from 'vitest'
import type { Session } from '../../api/types'
import { groupLabelFor, groupSessions } from './group-sessions'

const NOW = new Date(2026, 10, 17, 15, 0, 0)

function session(sessionId: string, daysBack: number, hour = 9): Session {
  const updated = new Date(2026, 10, 17 - daysBack, hour, 0, 0)
  return {
    sessionId,
    title: `Chat ${sessionId}`,
    mode: 'chat',
    modelId: 'm',
    createdAt: updated.toISOString(),
    updatedAt: updated.toISOString(),
    messageCount: 2,
  }
}

describe('groupSessions', () => {
  it('buckets by calendar day in the viewer time zone', () => {
    expect(groupLabelFor(session('a', 0, 0).updatedAt, NOW)).toBe('Today')
    expect(groupLabelFor(session('b', 1, 23).updatedAt, NOW)).toBe('Yesterday')
    expect(groupLabelFor(session('c', 2).updatedAt, NOW)).toBe('Previous 7 days')
    expect(groupLabelFor(session('d', 7).updatedAt, NOW)).toBe('Previous 7 days')
    expect(groupLabelFor(session('e', 8).updatedAt, NOW)).toBe('Older')
  })

  it('keeps group order, keeps item order and drops empty groups', () => {
    const groups = groupSessions([session('1', 0), session('2', 0, 8), session('3', 30), session('4', 3)], NOW)
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Previous 7 days', 'Older'])
    expect(groups[0]?.sessions.map((s) => s.sessionId)).toEqual(['1', '2'])
  })

  it('returns no groups for no sessions', () => {
    expect(groupSessions([], NOW)).toEqual([])
  })
})
