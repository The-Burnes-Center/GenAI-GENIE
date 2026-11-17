// The whole mock backend as one mutable object. resetStore() rebuilds it (tests call it between cases).
import type { AdminUser, AuditEntry, FeedbackRecord, ModelConfig, Settings, Template, UsageReport, Workspace, WorkspaceDocument } from '../api/types'
import { initialModels, initialSettings, initialDocuments, initialTemplates, initialWorkspaces } from './seed-catalog'
import { initialAudit, initialFeedback, initialUsage, initialUsers } from './seed-people'
import { seedSessions, type MockSession } from './seed-sessions'

export interface MockStore {
  settings: Settings
  models: ModelConfig[]
  templates: Template[]
  workspaces: Workspace[]
  documents: Record<string, WorkspaceDocument[]>
  // Document id to the epoch ms when its simulated indexing job finishes.
  indexingUntil: Record<string, number>
  sessions: MockSession[]
  users: AdminUser[]
  feedback: FeedbackRecord[]
  audit: AuditEntry[]
  usage: UsageReport
  // Messages sent today, for the daily limit and the bootstrap usage block.
  dailyUsed: number
  counter: number
}

function createStore(now: number): MockStore {
  const documents = initialDocuments()
  return {
    settings: initialSettings(),
    models: initialModels(),
    templates: initialTemplates(),
    workspaces: initialWorkspaces(documents),
    documents,
    indexingUntil: {},
    sessions: seedSessions(now),
    users: initialUsers(),
    feedback: initialFeedback(),
    audit: initialAudit(),
    usage: initialUsage(),
    dailyUsed: 12,
    counter: 0,
  }
}

let current = createStore(Date.now())

export function getStore(): MockStore {
  return current
}

export function resetStore(now: number = Date.now()): void {
  current = createStore(now)
}

// Ids for rows created in a session. Unique within one page load, which is all a mock needs.
export function nextId(prefix: string): string {
  current.counter += 1
  return `${prefix}${Date.now().toString(36)}${current.counter.toString(36)}`
}
