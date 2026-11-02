import { describe, expect, it } from 'vitest'
import type { WorkspaceSessionState } from '../../../../../shared/workspace-session-state-types'
import { createTestStore, makeTabGroup, makeUnifiedTab, makeWorktree } from '../store-test-helpers'
import { makeTerminalTab } from '../worktrees-slice-test-fixtures'
import { installSidePanelNormalizer } from './side-panel-normalizer'

const A = 'repo1::/work/a'
const B = 'repo1::/work/b'

function terminalSession(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({
    id,
    worktreeId,
    groupId,
    contentType: 'terminal',
    entityId: id,
    viewMode: 'terminal',
    label: id
  })
}

describe('a pane that shows a terminal-backed session of another workspace, after a restart', () => {
  it('is still there once the saved session is loaded and every workspace is reconciled', () => {
    const store = createTestStore()
    const stop = installSidePanelNormalizer(store)
    store.setState({
      worktreesByRepo: {
        repo1: [makeWorktree({ id: A, repoId: 'repo1' }), makeWorktree({ id: B, repoId: 'repo1' })]
      }
    })
    const session: WorkspaceSessionState = {
      activeRepoId: 'repo1',
      activeWorktreeId: A,
      activeTabId: null,
      tabsByWorktree: {
        [A]: [makeTerminalTab({ id: 'a-term', worktreeId: A, ptyId: 'pty-a' })],
        [B]: [makeTerminalTab({ id: 'b-term', worktreeId: B, ptyId: 'pty-b' })]
      },
      terminalLayoutsByTabId: {},
      unifiedTabs: {
        [A]: [terminalSession('a-term', A, 'a-main')],
        [B]: [terminalSession('b-term', B, 'b-main')]
      },
      tabGroups: {
        [A]: [
          makeTabGroup({
            id: 'a-main',
            worktreeId: A,
            tabOrder: ['a-term'],
            activeTabId: 'a-term'
          }),
          {
            ...makeTabGroup({ id: 'a-ref', worktreeId: A, tabOrder: [], activeTabId: null }),
            sessionRef: { worktreeId: B, tabId: 'b-term' }
          }
        ],
        [B]: [
          makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-term'], activeTabId: 'b-term' })
        ]
      },
      tabGroupLayouts: {
        [A]: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: 'a-main' },
          second: { type: 'leaf', groupId: 'a-ref' }
        },
        [B]: { type: 'leaf', groupId: 'b-main' }
      },
      activeGroupIdByWorktree: { [A]: 'a-main', [B]: 'b-main' }
    }
    store.setState({ tabsByWorktree: session.tabsByWorktree })
    store.getState().hydrateTabsSession(session)
    store.getState().reconcileWorktreeTabModels([A, B])
    const refPane = store.getState().groupsByWorktree[A].find((group) => group.id === 'a-ref')
    expect(refPane?.sessionRef).toEqual({ worktreeId: B, tabId: 'b-term' })
    expect(store.getState().layoutByWorktree[A]).toMatchObject({ type: 'split' })
    stop()
  })
})
