// Users, feedback, audit and usage for mock mode. Names and numbers are invented, as in the prototype.
import type { AdminUser, AuditEntry, FeedbackRecord, UsageReport, UsageTotals } from '../api/types'
import { GPT_ID, HAIKU_ID, MISTRAL_ID, NOVA_PRO_ID, OPUS_ID, SEED_NOW_ISO, SONNET_ID } from './seed-catalog'

const LONG_AGO_ISO = '2026-10-02T12:00:00.000Z'

function user(
  sub: string,
  email: string,
  profileStatus: AdminUser['profileStatus'],
  isAdmin: boolean,
  createdAt: string,
  lastSeenAt?: string,
  cognitoStatus = 'CONFIRMED',
): AdminUser {
  return {
    username: sub,
    sub,
    email,
    cognitoStatus: profileStatus === 'suspended' ? 'DISABLED' : cognitoStatus,
    profileStatus,
    enabled: profileStatus !== 'suspended',
    isAdmin,
    createdAt,
    ...(lastSeenAt ? { lastSeenAt } : {}),
  }
}

export function initialUsers(): AdminUser[] {
  return [
    user('mock-admin', 'staff.member@example.org', 'active', true, '2026-06-01T12:00:00.000Z', SEED_NOW_ISO),
    user('mock-u2', 'records.clerk@example.org', 'active', false, '2026-07-10T12:00:00.000Z', SEED_NOW_ISO),
    user('mock-u3', 'front.desk@example.org', 'active', false, '2026-07-14T12:00:00.000Z', '2026-11-16T15:00:00.000Z'),
    user('mock-u4', 'planning.analyst@example.org', 'active', false, '2026-08-02T12:00:00.000Z', '2026-11-12T15:00:00.000Z'),
    user('mock-u5', 'communications@example.org', 'active', true, '2026-08-20T12:00:00.000Z', '2026-11-10T13:00:00.000Z'),
    user('mock-u6', 'new.hire@example.org', 'active', false, '2026-11-12T11:20:00.000Z', undefined, 'FORCE_CHANGE_PASSWORD'),
    user('mock-u7', 'former.contractor@example.org', 'suspended', false, '2026-05-04T12:00:00.000Z', LONG_AGO_ISO),
    user('mock-p1', 'budget.office@example.org', 'pending', false, '2026-11-17T13:12:00.000Z'),
    user('mock-p2', 'parks.dept@example.gov', 'pending', false, '2026-11-16T20:40:00.000Z'),
  ]
}

export function initialFeedback(): FeedbackRecord[] {
  return [
    {
      id: '2026-11-17T14:04:00.000Z#c1-m1',
      sessionId: 'c1',
      messageId: 'c1-m1',
      rating: 'down',
      comment: 'The date it gave for the filing deadline was wrong.',
      modelId: GPT_ID,
      userEmail: 'front.desk@example.org',
      promptExcerpt: 'When is the annual business license renewal due?',
      responseExcerpt: 'Annual business licenses must be renewed by March 31 each year. Late fees begin on April 1...',
      reviewed: false,
      at: '2026-11-17T14:04:00.000Z',
    },
    {
      id: '2026-11-16T14:18:00.000Z#c2-m1',
      sessionId: 'c2',
      messageId: 'c2-m1',
      rating: 'down',
      comment: '',
      modelId: HAIKU_ID,
      userEmail: 'records.clerk@example.org',
      promptExcerpt: 'Summarize this 40 page report in one paragraph.',
      responseExcerpt: 'The report reviews three years of records requests and finds that response times improved...',
      reviewed: false,
      at: '2026-11-16T14:18:00.000Z',
    },
    {
      id: '2026-11-12T15:51:00.000Z#c3-m1',
      sessionId: 'c3',
      messageId: 'c3-m1',
      rating: 'down',
      comment: 'Too wordy. I asked for three bullet points.',
      modelId: MISTRAL_ID,
      userEmail: 'planning.analyst@example.org',
      promptExcerpt: 'Give me three bullet points on the zoning change.',
      responseExcerpt: 'Certainly! The zoning change, which was approved by the commission after extensive review, includes several...',
      reviewed: true,
      at: '2026-11-12T15:51:00.000Z',
    },
    {
      id: '2026-11-10T10:05:00.000Z#c9-m1',
      sessionId: 'c9',
      messageId: 'c9-m1',
      rating: 'up',
      comment: 'Clear and to the point.',
      modelId: SONNET_ID,
      userEmail: 'communications@example.org',
      promptExcerpt: 'Draft an outline for a grant application.',
      responseExcerpt: 'Here is an outline with the sections most funders expect...',
      reviewed: false,
      at: '2026-11-10T10:05:00.000Z',
    },
  ]
}

export function initialAudit(): AuditEntry[] {
  const entry = (at: string, actorEmail: string, action: string, target: string, note: string): AuditEntry => ({
    id: `${at}#${action.toLowerCase().replace(/\W+/g, '-')}`,
    at,
    actorSub: 'mock-admin',
    actorEmail,
    action,
    target,
    details: { note },
  })
  const admin = 'staff.member@example.org'
  return [
    entry('2026-11-17T14:30:00.000Z', admin, 'Changed settings', 'Sign-up', 'Require approval: on'),
    entry('2026-11-17T14:02:00.000Z', admin, 'Tested model', 'Grok 4.7', 'Failed: access not enabled'),
    entry('2026-11-16T16:10:00.000Z', 'communications@example.org', 'Edited template', 'Press release first draft', 'Starter prompt changed'),
    entry('2026-11-12T16:20:00.000Z', admin, 'Invited user', 'new.hire@example.org', 'Role: user'),
    entry('2026-11-10T18:05:00.000Z', admin, 'Turned off model', 'DeepSeek V3.2', 'Enabled: off'),
    entry('2026-11-03T13:44:00.000Z', admin, 'Suspended user', 'former.contractor@example.org', 'Status: suspended'),
  ]
}

export function initialUsage(): UsageReport {
  const requestsPerDay = [38, 52, 61, 44, 0, 0, 47, 88, 120, 134, 109, 126, 187, 143]
  const dates = requestsPerDay.map((_, index) => {
    const day = new Date(Date.UTC(2026, 10, 17 - (requestsPerDay.length - 1 - index)))
    return day.toISOString().slice(0, 10)
  })
  const totals = (requests: number, inputTokens: number, outputTokens: number): UsageTotals => ({ requests, inputTokens, outputTokens })
  const byDay = dates.map((day, index) => ({ day, ...totals(requestsPerDay[index], requestsPerDay[index] * 3400, requestsPerDay[index] * 1500) }))
  const byModel = [
    { modelId: SONNET_ID, ...totals(612, 1_900_000, 840_000) },
    { modelId: HAIKU_ID, ...totals(214, 310_000, 120_000) },
    { modelId: GPT_ID, ...totals(98, 220_000, 90_000) },
    { modelId: NOVA_PRO_ID, ...totals(61, 400_000, 50_000) },
    { modelId: OPUS_ID, ...totals(33, 280_000, 110_000) },
  ]
  const person = (sub: string, email: string, t: UsageTotals) => ({ sub, email, ...t })
  const byUser = [
    person('mock-u2', 'records.clerk@example.org', totals(241, 630_000, 270_000)),
    person('mock-u4', 'planning.analyst@example.org', totals(203, 840_000, 360_000)),
    person('mock-u3', 'front.desk@example.org', totals(188, 280_000, 120_000)),
    person('mock-u5', 'communications@example.org', totals(152, 490_000, 210_000)),
    person('mock-admin', 'staff.member@example.org', totals(106, 350_000, 150_000)),
    person('mock-p1', 'budget.office@example.org', totals(28, 70_000, 30_000)),
  ]
  const sum = (rows: UsageTotals[]): UsageTotals => ({
    requests: rows.reduce((total, item) => total + item.requests, 0),
    inputTokens: rows.reduce((total, item) => total + item.inputTokens, 0),
    outputTokens: rows.reduce((total, item) => total + item.outputTokens, 0),
  })
  return { from: dates[0], to: dates[dates.length - 1], totals: { key: 'all', ...sum(byDay) }, byDay, byModel, byUser }
}
