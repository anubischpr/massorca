import { describe, expect, it } from 'vitest'
import { createTestStore } from '../../store/slices/store-test-helpers'
import { deriveApprovalRows } from './tasks-home-approvals'

const WT = 'repo::/work/a'
const LEAF = '11111111-1111-4111-8111-111111111111'
const HOUR_MS = 60 * 60 * 1000

describe('deriveApprovalRows over the agent status store', () => {
  it('lists a blocked hook session the store accepted, and drops it once it is done', () => {
    const store = createTestStore()
    const now = Date.now()
    const routing = { tabId: 'tab-1', worktreeId: WT }
    store
      .getState()
      .setAgentStatus(
        `tab-1:${LEAF}`,
        { state: 'blocked', prompt: 'Migrate the schema', agentType: 'claude', toolName: 'Bash' },
        'Claude Code',
        { updatedAt: now },
        routing
      )
    expect(deriveApprovalRows(store.getState(), now)).toEqual([
      expect.objectContaining({ paneKey: `tab-1:${LEAF}`, tabId: 'tab-1', worktreeId: WT, line: 'Bash' })
    ])

    store
      .getState()
      .setAgentStatus(
        `tab-1:${LEAF}`,
        { state: 'done', prompt: 'Migrate the schema', agentType: 'claude' },
        'Claude Code',
        { updatedAt: now + 1 },
        routing
      )
    expect(deriveApprovalRows(store.getState(), now + 1)).toEqual([])
  })

  it('keeps a native chat waiting on an approval listed for as long as its host owns the run', () => {
    const store = createTestStore()
    const now = Date.now()
    const requestedAt = now - 2 * HOUR_MS
    store
      .getState()
      .setAgentStatus(
        `structured-agent-session-s1:${LEAF}`,
        { state: 'blocked', prompt: 'Run the migration', agentType: 'claude' },
        'Run the migration',
        { updatedAt: requestedAt, stateStartedAt: requestedAt, allowOlderTimestamp: true },
        { tabId: 'structured-agent-session-s1', worktreeId: WT },
        { structuredHostOwned: true, providerSessionAuthoritative: true, terminalResumeEligible: false }
      )
    expect(deriveApprovalRows(store.getState(), now).map((row) => row.tabId)).toEqual([
      'structured-agent-session-s1'
    ])
  })
})
