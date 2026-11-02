import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'

vi.mock('../tab-bar/web-runtime-tab-move-mirror', () => ({ mirrorWebRuntimeTabMove: vi.fn() }))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const { makeWorktree } = await import('../../store/slices/worktrees-slice-test-fixtures')
const testStore = createTestStore()
vi.mock('../../store', () => ({ useAppStore: testStore }))

const { listOtherWorkspaceSessionGroups, chooseSessionForPane, closeSessionPane } =
  await import('./session-picker-pane')

const A = 'repo1::/work/a'
const B = 'repo1::/work/b'
const REMOTE = 'repo-ssh::/srv/c'
const FOLDER = 'folder:f1'

function session(id: string, worktreeId: string, groupId: string, label = id) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label })
}

function mainGroup(worktreeId: string, tabOrder: string[]) {
  return makeTabGroup({
    id: `${worktreeId}-main`,
    worktreeId,
    tabOrder,
    activeTabId: tabOrder[0] ?? null
  })
}

const REPOS = [
  { id: 'repo1', path: '/repo1', displayName: 'Orca', badgeColor: '#000', addedAt: 0 },
  {
    id: 'repo-ssh',
    path: '/srv',
    displayName: 'Remote app',
    badgeColor: '#000',
    addedAt: 0,
    connectionId: 'ssh-1'
  }
]

const folderWorkspace: FolderWorkspace = {
  id: 'f1',
  projectGroupId: 'group-1',
  name: 'Notes folder',
  folderPath: '/notes',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: 0,
  createdAt: 0,
  updatedAt: 0
}

beforeEach(() => {
  seedStore(testStore, {
    repos: REPOS,
    worktreesByRepo: {
      repo1: [
        makeWorktree({ id: A, repoId: 'repo1', displayName: 'main' }),
        makeWorktree({ id: B, repoId: 'repo1', displayName: 'feature-login' })
      ],
      'repo-ssh': [makeWorktree({ id: REMOTE, repoId: 'repo-ssh', displayName: 'staging' })]
    },
    folderWorkspaces: [folderWorkspace],
    activeWorktreeId: A,
    unifiedTabsByWorktree: {
      [A]: [session('a1', A, `${A}-main`, 'Local session')],
      [B]: [session('b1', B, `${B}-main`, 'Fix the login'), session('b2', B, `${B}-main`, 'Docs')],
      [REMOTE]: [session('r1', REMOTE, `${REMOTE}-main`, 'Remote session')],
      [FOLDER]: [session('f1s', FOLDER, `${FOLDER}-main`, 'Folder session')]
    },
    groupsByWorktree: {
      [A]: [mainGroup(A, ['a1'])],
      [B]: [mainGroup(B, ['b1', 'b2'])],
      [REMOTE]: [mainGroup(REMOTE, ['r1'])],
      [FOLDER]: [mainGroup(FOLDER, ['f1s'])]
    },
    activeGroupIdByWorktree: { [A]: `${A}-main` },
    layoutByWorktree: { [A]: { type: 'leaf', groupId: `${A}-main` } }
  })
})

describe('the sessions of other workspaces the new pane offers', () => {
  it('groups them by project and workspace with the sidebar labels, local, SSH and folder alike', () => {
    const groups = listOtherWorkspaceSessionGroups(testStore.getState(), A)
    expect(groups.map((group) => [group.heading, group.candidates.map((c) => c.label)])).toEqual([
      ['Orca / feature-login', ['Fix the login', 'Docs']],
      ['Remote app / staging', ['Remote session']],
      ['Notes folder', ['Folder session']]
    ])
  })

  it('names the workspace that owns each session so choosing it can reference it', () => {
    const [first] = listOtherWorkspaceSessionGroups(testStore.getState(), A)
    expect(first.candidates[0]).toEqual({ tabId: 'b1', label: 'Fix the login', worktreeId: B })
  })

  it('leaves out the layout’s own workspace, side panel tabs, and workspaces with no session', () => {
    seedStore(testStore, {
      repos: REPOS,
      unifiedTabsByWorktree: {
        ...testStore.getState().unifiedTabsByWorktree,
        [B]: [
          makeUnifiedTab({
            id: 'doc',
            worktreeId: B,
            groupId: `side-panel:${B}`,
            contentType: 'editor',
            label: 'notes.md'
          })
        ]
      }
    })
    const headings = listOtherWorkspaceSessionGroups(testStore.getState(), A).map((g) => g.heading)
    expect(headings).toEqual(['Remote app / staging', 'Notes folder'])
  })

  it('never offers a session another pane already shows', () => {
    seedStore(testStore, {
      groupsByWorktree: {
        ...testStore.getState().groupsByWorktree,
        [A]: [
          mainGroup(A, ['a1']),
          {
            ...makeTabGroup({ id: 'a-ref', worktreeId: A, tabOrder: [], activeTabId: null }),
            sessionRef: { worktreeId: B, tabId: 'b1' }
          }
        ]
      }
    })
    const first = listOtherWorkspaceSessionGroups(testStore.getState(), A)[0]
    expect(first.candidates.map((candidate) => candidate.tabId)).toEqual(['b2'])
  })
})

describe('choosing a session for the new pane', () => {
  it('shows another workspace’s session by reference and leaves it in its workspace', () => {
    const paneId = testStore.getState().createEmptySplitGroup(A, `${A}-main`, 'right')!
    expect(chooseSessionForPane(A, paneId, { tabId: 'b1', worktreeId: B })).toBe(true)
    const state = testStore.getState()
    expect(state.groupsByWorktree[A].find((group) => group.id === paneId)?.sessionRef).toEqual({
      worktreeId: B,
      tabId: 'b1'
    })
    expect(state.groupsByWorktree[B][0].tabOrder).toEqual(['b1', 'b2'])
  })

  it('still moves a session of the same workspace into the pane', () => {
    seedStore(testStore, {
      unifiedTabsByWorktree: {
        ...testStore.getState().unifiedTabsByWorktree,
        [A]: [session('a1', A, `${A}-main`), session('a2', A, `${A}-main`)]
      },
      groupsByWorktree: {
        ...testStore.getState().groupsByWorktree,
        [A]: [mainGroup(A, ['a1', 'a2'])]
      }
    })
    const paneId = testStore.getState().createEmptySplitGroup(A, `${A}-main`, 'right')!
    expect(chooseSessionForPane(A, paneId, { tabId: 'a2', worktreeId: A })).toBe(true)
    const state = testStore.getState()
    expect(state.groupsByWorktree[A].find((group) => group.id === paneId)?.tabOrder).toEqual(['a2'])
    expect(state.groupsByWorktree[A].find((group) => group.id === paneId)?.sessionRef).toBe(
      undefined
    )
  })

  it('refuses a session that another pane already shows', () => {
    const first = testStore.getState().createEmptySplitGroup(A, `${A}-main`, 'right')!
    chooseSessionForPane(A, first, { tabId: 'b1', worktreeId: B })
    const second = testStore.getState().createEmptySplitGroup(A, first, 'down')!
    expect(chooseSessionForPane(A, second, { tabId: 'b1', worktreeId: B })).toBe(false)
  })
})

describe('closing a pane that shows another workspace’s session', () => {
  it('closes the pane and leaves the session alive in its own workspace', () => {
    const paneId = testStore.getState().createEmptySplitGroup(A, `${A}-main`, 'right')!
    chooseSessionForPane(A, paneId, { tabId: 'b1', worktreeId: B })
    expect(closeSessionPane(A, paneId)).toBe(true)
    const state = testStore.getState()
    expect(state.groupsByWorktree[A].map((group) => group.id)).toEqual([`${A}-main`])
    expect(state.layoutByWorktree[A]).toEqual({ type: 'leaf', groupId: `${A}-main` })
    expect(state.unifiedTabsByWorktree[B].map((tab) => tab.id)).toEqual(['b1', 'b2'])
    expect(state.groupsByWorktree[B][0].tabOrder).toEqual(['b1', 'b2'])
  })
})
