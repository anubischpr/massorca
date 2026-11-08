import { afterEach, describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { useAppStore } from '../store'
import { makeTabGroup, makeUnifiedTab } from '../store/slices/store-test-helpers'
import { applyTerminalColdActivation } from './terminal-cold-activation'
import type { TerminalParkingFoundation } from './use-terminal-parking-foundation'

const FLOAT = FLOATING_TERMINAL_WORKTREE_ID
const ACTIVE = 'repo::/work/active'
const VPS = 'repo::/work/vps'

const initialState = useAppStore.getState()

function seedFloatingReference(isActive: boolean): void {
  const refTab = {
    ...makeUnifiedTab({
      id: 'ref-tab',
      worktreeId: FLOAT,
      groupId: 'float-main',
      contentType: 'session-ref',
      label: 'vps-chat'
    }),
    sessionRef: { worktreeId: VPS, tabId: 'vps-chat' }
  }
  useAppStore.setState({
    unifiedTabsByWorktree: {
      [ACTIVE]: [],
      [VPS]: [
        makeUnifiedTab({
          id: 'vps-chat',
          worktreeId: VPS,
          groupId: 'vps-main',
          contentType: 'agent-session',
          label: 'vps-chat'
        })
      ],
      [FLOAT]: [
        refTab,
        makeUnifiedTab({
          id: 'float-check',
          worktreeId: FLOAT,
          groupId: 'float-main',
          contentType: 'checklist',
          label: 'Checklist'
        })
      ]
    },
    groupsByWorktree: {
      [ACTIVE]: [],
      [VPS]: [
        makeTabGroup({
          id: 'vps-main',
          worktreeId: VPS,
          tabOrder: ['vps-chat'],
          activeTabId: 'vps-chat'
        })
      ],
      [FLOAT]: [
        makeTabGroup({
          id: 'float-main',
          worktreeId: FLOAT,
          tabOrder: ['ref-tab', 'float-check'],
          activeTabId: isActive ? 'ref-tab' : 'float-check'
        })
      ]
    }
  })
}

function runColdActivation(renderedActiveWorktreeId: string | null): Set<string> {
  const mounted = new Set<string>()
  const state = useAppStore.getState()
  const controller = {
    activationDeferralPlanRevisionRef: { current: 0 },
    activationDeferredMountTabIdsByWorktreeRef: { current: new Map() },
    activeGroupIdByWorktree: {},
    activeTabId: null,
    activeTabIdByWorktree: {},
    activeWorktreeDeferralHostId: null,
    activityTerminalPortals: [],
    backgroundMountTabIdsByWorktreeRef: { current: new Map() },
    groupsByWorktree: state.groupsByWorktree,
    hydrationSucceeded: true,
    lastActivationWorktreeIdRef: { current: null },
    layoutByWorktree: {},
    mountedWorktreeIdsRef: { current: mounted },
    pairedRuntimeParkingEnvironmentIds: [],
    pendingStartupByTabId: {},
    renderedActiveWorktreeId,
    startupTerminalTabHoldRef: { current: null },
    startupWorktreeRefreshCompleted: true,
    tabsByWorktree: {},
    terminalParkingEnabled: false,
    terminalTitleSnapshotAuthorityEnabled: false,
    workspaceSessionReady: true,
    workspaceSurfaceIds: [ACTIVE, VPS],
    workspaceSurfaceIdSet: new Set([ACTIVE, VPS])
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the pass reads only the fields stubbed above.
  applyTerminalColdActivation(controller as unknown as TerminalParkingFoundation)
  return mounted
}

afterEach(() => {
  useAppStore.setState(initialState, true)
})

describe('cold activation of a workspace a floating tab shows by reference', () => {
  it('mounts the owner of a floating session tab although it is not the active workspace', () => {
    seedFloatingReference(true)
    expect([...runColdActivation(ACTIVE)].sort()).toEqual([ACTIVE, VPS].sort())
  })

  it('mounts that owner when the main window has no active workspace', () => {
    seedFloatingReference(true)
    expect([...runColdActivation(null)]).toEqual([VPS])
  })

  it('does not mount the owner while the floating session tab is not the active tab', () => {
    seedFloatingReference(false)
    expect([...runColdActivation(ACTIVE)]).toEqual([ACTIVE])
  })
})
