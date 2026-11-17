import { describe, expect, it } from 'vitest'
import type { DocumentStatus, WorkspaceDetail } from './types'
import { DOCUMENT_POLL_MS, documentPollInterval } from './workspaces'

function detailWith(...statuses: DocumentStatus[]): WorkspaceDetail {
  return {
    workspace: { workspaceId: 'w', name: 'W', description: '', visibility: 'personal', ownerSub: 's', ownerEmail: 'e', createdAt: '', docCount: statuses.length },
    documents: statuses.map((status, index) => ({ docId: `d${index}`, workspaceId: 'w', name: 'f.pdf', contentType: 'application/pdf', size: 1, s3Key: `workspaces/w/d${index}/source.pdf`, status, createdAt: '' })),
  }
}

describe('documentPollInterval', () => {
  it('polls while a document is uploading, uploaded or indexing', () => {
    expect(documentPollInterval(detailWith('uploading'))).toBe(DOCUMENT_POLL_MS)
    expect(documentPollInterval(detailWith('ready', 'indexing'))).toBe(DOCUMENT_POLL_MS)
    expect(documentPollInterval(detailWith('uploaded'))).toBe(DOCUMENT_POLL_MS)
  })

  it('stops once every document is ready or failed, or there are none', () => {
    expect(documentPollInterval(detailWith('ready', 'failed'))).toBe(false)
    expect(documentPollInterval(detailWith())).toBe(false)
    expect(documentPollInterval(undefined)).toBe(false)
  })
})
