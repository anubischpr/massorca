import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { deriveApprovalRows, type ApprovalSourceState } from './tasks-home-approvals'

const NOW = 1_000_000
const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const pk = (tabId: string): string => `${tabId}:${LEAF_ID}`
const WT = 'repo::/work/a'

function entry(
  overrides: Partial<AgentStatusEntry> & Pick<AgentStatusEntry, 'paneKey'>
): AgentStatusEntry {
  return {
    state: 'blocked',
    prompt: '',
    updatedAt: NOW - 1_000,
    stateStartedAt: NOW - 5_000,
    stateHistory: [],
    worktreeId: WT,
    agentType: 'claude',
    ...overrides
  } as AgentStatusEntry
}

function state(
  entries: AgentStatusEntry[],
  extras: Partial<ApprovalSourceState> = {}
): ApprovalSourceState {
  return {
    agentStatusByPaneKey: Object.fromEntries(entries.map((e) => [e.paneKey, e])),
    tabsByWorktree: {},
    unifiedTabsByWorktree: {},
    settings: null,
    ...extras
  }
}

describe('deriveApprovalRows', () => {
  it('lists sessions that are blocked or waiting on the user', () => {
    const rows = deriveApprovalRows(
      state([
        entry({ paneKey: pk('tab-1'), state: 'blocked' }),
        entry({ paneKey: pk('tab-2'), state: 'waiting' }),
        entry({ paneKey: pk('tab-3'), state: 'working' }),
        entry({ paneKey: pk('tab-4'), state: 'done' })
      ]),
      NOW
    )
    expect(rows.map((row) => row.paneKey).sort()).toEqual([pk('tab-1'), pk('tab-2')])
  })

  it('ignores a stale or unconfirmed restored status', () => {
    const rows = deriveApprovalRows(
      state([
        entry({ paneKey: pk('tab-1'), updatedAt: NOW - 24 * 60 * 60 * 1000 }),
        entry({ paneKey: pk('tab-2'), restoredUnconfirmed: true })
      ]),
      NOW
    )
    expect(rows).toEqual([])
  })

  it('names the row after its session tab and says what it waits on', () => {
    const rows = deriveApprovalRows(
      state(
        [
          entry({
            paneKey: pk('tab-1'),
            toolName: 'Bash',
            lastAssistantMessage: 'Run the tests?\nMore'
          })
        ],
        {
          unifiedTabsByWorktree: {
            [WT]: [
              {
                id: 'tab-1',
                entityId: 'tab-1',
                groupId: 'g',
                worktreeId: WT,
                contentType: 'agent-session',
                label: 'Fix the login redirect',
                customLabel: null,
                color: null,
                sortOrder: 0,
                createdAt: 0
              }
            ]
          }
        }
      ),
      NOW
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      title: 'Fix the login redirect',
      line: 'Run the tests?',
      worktreeId: WT,
      tabId: 'tab-1'
    })
  })

  it('falls back to the prompt, then the tool, when the tab has no name', () => {
    const [withPrompt] = deriveApprovalRows(
      state([entry({ paneKey: pk('tab-1'), prompt: 'Migrate the schema', toolName: 'Edit' })]),
      NOW
    )
    expect(withPrompt.title).toBe('Migrate the schema')
    expect(withPrompt.line).toBe('Edit')
  })

  it('skips a session whose workspace cannot be resolved, and lists the longest wait first', () => {
    const rows = deriveApprovalRows(
      state([
        entry({ paneKey: pk('tab-1'), stateStartedAt: NOW - 1_000 }),
        entry({ paneKey: pk('tab-2'), stateStartedAt: NOW - 9_000 }),
        entry({ paneKey: pk('tab-3'), worktreeId: undefined })
      ]),
      NOW
    )
    expect(rows.map((row) => row.paneKey)).toEqual([pk('tab-2'), pk('tab-1')])
  })
})
