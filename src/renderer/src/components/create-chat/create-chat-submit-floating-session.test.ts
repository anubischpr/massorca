// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { makeTabGroup, makeWorktree, seedStore } from '../../store/slices/store-test-helpers'
import { openFloatingCreateSessionTab } from '../floating-terminal/create-session/floating-create-session-tab'
import { resolveFloatingWorkspaceSurfaceModel } from '../floating-terminal/floating-workspace-surface-model'
import {
  markFloatingCreateLaunchStarted,
  useFloatingCreateLaunchStore
} from '../../lib/floating-workspace-create-launch'
import type { WorktreeCreationRequest } from '@/lib/pending-worktree-creation'
import type { CreateChatSelection } from './create-chat-selection'

const FLOATING = FLOATING_TERMINAL_WORKTREE_ID

const mocks = vi.hoisted(() => ({
  runBackgroundWorktreeCreation: vi.fn(),
  beginStructuredAgentSessionProvisionalLaunch: vi.fn(),
  toastError: vi.fn()
}))

// Why: the real app store is replaced by the test store built from the real slices, so tab, reference and surface logic run as in the app.
vi.mock('@/store', async () => {
  const { createTestStore } = await import('../../store/slices/store-test-helpers')
  return { useAppStore: createTestStore() }
})
vi.mock('@/lib/new-workspace', () => ({ getWorkspaceSeedName: () => 'fix-login' }))
vi.mock('@/lib/worktree-activation', () => ({ activateAndRevealWorkspace: vi.fn(() => false) }))
// Why: the creation executor is the process boundary; each test plays its effects into the store.
vi.mock('@/lib/worktree-creation-flow', () => ({
  runBackgroundWorktreeCreation: mocks.runBackgroundWorktreeCreation
}))
// Why: the agent launch is the host boundary; each test publishes the owner's tab the way a host does.
vi.mock('@/lib/structured-agent-session-provisional-tab', () => ({
  beginStructuredAgentSessionProvisionalLaunch: mocks.beginStructuredAgentSessionProvisionalLaunch
}))
vi.mock('@/lib/structured-agent-session-launch-options', () => ({
  holdStructuredAgentSessionLaunchPicks: vi.fn()
}))
vi.mock('@/lib/launch-agent-in-new-tab', () => ({ launchAgentInNewTab: vi.fn() }))
vi.mock('@/runtime/web-runtime-terminal-creation', () => ({
  createWebRuntimeSessionTerminal: vi.fn()
}))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('@/lib/agent-session-launch-plan', () => ({
  // Why: the verdict is the plan's data; the launch itself is mocked at its own boundary.
  adoptAgentSessionLaunchVerdict: <T>(verdict: T): T => verdict
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, info: vi.fn() } }))

import { useAppStore } from '@/store'
import { submitCreateChatDraft } from './create-chat-submit'

function selection(overrides: Partial<CreateChatSelection> = {}): CreateChatSelection {
  return {
    executionHostId: 'local',
    project: { kind: 'repo', repoId: 'repo1' },
    workspaceMode: 'existing-worktree',
    existingWorktreeId: 'wt-main',
    agent: 'claude',
    accessMode: 'default',
    ...overrides
  }
}

function floatingTabsOf(contentType: string) {
  return (useAppStore.getState().unifiedTabsByWorktree[FLOATING] ?? []).filter(
    (tab) => tab.contentType === contentType
  )
}

/** Opens the New Session tab the way "+ New Session" does, and returns it. */
function openNewSessionTab() {
  const tabId = openFloatingCreateSessionTab('New Session')
  const tab = floatingTabsOf('create-session').find((candidate) => candidate.id === tabId)
  if (!tab) {
    throw new Error('the New Session tab did not open')
  }
  return tab
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore(useAppStore, {
    activeWorktreeId: 'wt-main',
    worktreesByRepo: {
      repo1: [makeWorktree({ id: 'wt-main', repoId: 'repo1', isMainWorktree: true })]
    },
    unifiedTabsByWorktree: { 'wt-main': [], [FLOATING]: [] },
    groupsByWorktree: {
      [FLOATING]: [
        makeTabGroup({ id: 'float-main', worktreeId: FLOATING, tabOrder: [], activeTabId: null })
      ]
    },
    activeGroupIdByWorktree: { [FLOATING]: 'float-main' },
    layoutByWorktree: { [FLOATING]: { type: 'leaf', groupId: 'float-main' } }
  })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { worktrees: { listRetiredNames: vi.fn(async () => ({ names: [] })) } }
  })
})

describe('New Session in the floating workspace', () => {
  it('opens one New Session tab that is active, and the panel shows it', () => {
    const createTab = openNewSessionTab()
    openFloatingCreateSessionTab('New Session')

    expect(floatingTabsOf('create-session')).toHaveLength(1)
    const state = useAppStore.getState()
    expect(createTab.groupId).toBe('float-main')
    expect(state.groupsByWorktree[FLOATING]?.[0]?.activeTabId).toBe(createTab.id)
    expect(resolveFloatingWorkspaceSurfaceModel(state).kind).toBe('workspace')
  })

  it('replaces its New Session tab with the session of a workspace it creates', async () => {
    const createTab = openNewSessionTab()
    markFloatingCreateLaunchStarted(createTab.id)
    mocks.runBackgroundWorktreeCreation.mockImplementation(
      (request: WorktreeCreationRequest, options?: { onCreated?: (id: string) => void }) => {
        const creationId = 'creation-1'
        useAppStore.getState().beginPendingWorktreeCreation({
          creationId,
          phase: 'creating',
          status: 'creating',
          startedAt: 0,
          indeterminate: false,
          loaderVisible: false,
          request
        })
        setTimeout(() => {
          // Why: the executor adds the workspace and launches its chat there, then ends the pending create.
          useAppStore.setState((state) => ({
            worktreesByRepo: {
              ...state.worktreesByRepo,
              repo1: [
                ...(state.worktreesByRepo.repo1 ?? []),
                makeWorktree({ id: 'wt-new', repoId: 'repo1' })
              ]
            }
          }))
          options?.onCreated?.('wt-new')
          useAppStore.getState().createUnifiedTab('wt-new', 'agent-session', {
            id: 'wt-new-chat',
            entityId: 'session-new',
            activate: false
          })
          useAppStore.getState().removePendingWorktreeCreation(creationId, { cleanupVm: false })
        }, 0)
        return creationId
      }
    )

    await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'new-worktree', existingWorktreeId: undefined }),
      { kind: 'floating-workspace', createTabId: createTab.id }
    )

    await vi.waitFor(() => expect(floatingTabsOf('session-ref')).toHaveLength(1))
    const [sessionTab] = floatingTabsOf('session-ref')
    expect(sessionTab?.sessionRef).toEqual({ worktreeId: 'wt-new', tabId: 'wt-new-chat' })
    expect(floatingTabsOf('create-session')).toHaveLength(0)
    const state = useAppStore.getState()
    expect(state.groupsByWorktree[FLOATING]?.[0]?.tabOrder).toEqual([sessionTab?.id])
    expect(state.groupsByWorktree[FLOATING]?.[0]?.activeTabId).toBe(sessionTab?.id)
    expect(resolveFloatingWorkspaceSurfaceModel(state).kind).toBe('workspace')
    expect(useFloatingCreateLaunchStore.getState().startingTabIds[createTab.id]).toBeUndefined()
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('shows the workspace its create made, not another one of the repo that lands first', async () => {
    const createTab = openNewSessionTab()
    markFloatingCreateLaunchStarted(createTab.id)
    const addWorktree = (id: string): void =>
      useAppStore.setState((state) => ({
        worktreesByRepo: {
          ...state.worktreesByRepo,
          repo1: [...(state.worktreesByRepo.repo1 ?? []), makeWorktree({ id, repoId: 'repo1' })]
        }
      }))
    mocks.runBackgroundWorktreeCreation.mockImplementation(
      (request: WorktreeCreationRequest, options?: { onCreated?: (id: string) => void }) => {
        const creationId = 'creation-race'
        useAppStore.getState().beginPendingWorktreeCreation({
          creationId,
          phase: 'creating',
          status: 'creating',
          startedAt: 0,
          indeterminate: false,
          loaderVisible: false,
          request
        })
        setTimeout(() => {
          // Why: a sidebar create or a refresh adds another workspace of the repo before this one.
          addWorktree('wt-other')
          useAppStore.getState().createUnifiedTab('wt-other', 'agent-session', {
            id: 'wt-other-chat',
            entityId: 'session-other',
            activate: false
          })
          addWorktree('wt-mine')
          options?.onCreated?.('wt-mine')
          useAppStore.getState().createUnifiedTab('wt-mine', 'agent-session', {
            id: 'wt-mine-chat',
            entityId: 'session-mine',
            activate: false
          })
          useAppStore.getState().removePendingWorktreeCreation(creationId, { cleanupVm: false })
        }, 0)
        return creationId
      }
    )

    await submitCreateChatDraft(
      'Fix login',
      selection({ workspaceMode: 'new-worktree', existingWorktreeId: undefined }),
      { kind: 'floating-workspace', createTabId: createTab.id }
    )

    await vi.waitFor(() => expect(floatingTabsOf('session-ref')).toHaveLength(1))
    expect(floatingTabsOf('session-ref')[0]?.sessionRef).toEqual({
      worktreeId: 'wt-mine',
      tabId: 'wt-mine-chat'
    })
    expect(floatingTabsOf('create-session')).toHaveLength(0)
  })

  it('shows a chat whose host publishes its tab under another id than the launch announced', async () => {
    const createTab = openNewSessionTab()
    mocks.beginStructuredAgentSessionProvisionalLaunch.mockImplementation(
      (args: { target: { worktreeId: string }; onOpened?: (sessionId: string) => void }) => {
        setTimeout(() => {
          useAppStore.getState().createUnifiedTab(args.target.worktreeId, 'agent-session', {
            id: 'host-tab-7',
            entityId: 'session-7',
            activate: false
          })
        }, 0)
        args.onOpened?.('session-7')
        return {
          sessionId: null,
          tab: null,
          settlement: new Promise(() => undefined),
          cancel: () => undefined
        }
      }
    )

    await submitCreateChatDraft('Fix login', selection(), {
      kind: 'floating-workspace',
      createTabId: createTab.id
    })

    await vi.waitFor(() => expect(floatingTabsOf('session-ref')).toHaveLength(1))
    expect(floatingTabsOf('session-ref')[0]?.sessionRef).toEqual({
      worktreeId: 'wt-main',
      tabId: 'host-tab-7'
    })
    expect(floatingTabsOf('create-session')).toHaveLength(0)
  })

  it('does not show a session whose New Session tab the person closed while it started', async () => {
    const createTab = openNewSessionTab()
    mocks.beginStructuredAgentSessionProvisionalLaunch.mockImplementation(
      (args: { target: { worktreeId: string }; onOpened?: (sessionId: string) => void }) => {
        setTimeout(() => {
          useAppStore.getState().createUnifiedTab(args.target.worktreeId, 'agent-session', {
            id: 'host-tab-8',
            entityId: 'session-8',
            activate: false
          })
        }, 0)
        args.onOpened?.('session-8')
        return {
          sessionId: null,
          tab: null,
          settlement: new Promise(() => undefined),
          cancel: () => undefined
        }
      }
    )

    await submitCreateChatDraft('Fix login', selection(), {
      kind: 'floating-workspace',
      createTabId: createTab.id
    })
    useAppStore.getState().closeUnifiedTab(createTab.id)

    await vi.waitFor(() =>
      expect(
        useAppStore
          .getState()
          .unifiedTabsByWorktree['wt-main']?.some((tab) => tab.id === 'host-tab-8')
      ).toBe(true)
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(floatingTabsOf('session-ref')).toHaveLength(0)
    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})

describe('waiting for a workspace that never comes', () => {
  it('ends the New Session tab wait with a message once the wait limit passes', async () => {
    vi.useFakeTimers()
    try {
      const createTab = openNewSessionTab()
      markFloatingCreateLaunchStarted(createTab.id)
      mocks.runBackgroundWorktreeCreation.mockImplementation((request: WorktreeCreationRequest) => {
        // Why: the create stays pending and never adds its workspace.
        useAppStore.getState().beginPendingWorktreeCreation({
          creationId: 'creation-stuck',
          phase: 'creating',
          status: 'creating',
          startedAt: 0,
          indeterminate: false,
          loaderVisible: false,
          request
        })
        return 'creation-stuck'
      })

      const outcome = await submitCreateChatDraft(
        'Fix login',
        selection({ workspaceMode: 'new-worktree', existingWorktreeId: undefined }),
        { kind: 'floating-workspace', createTabId: createTab.id }
      )

      expect(outcome).toEqual({ started: true })
      // Why: the wait starts once the lazily loaded launch module resolves, so it is awaited before time moves.
      await vi.waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0))
      await vi.advanceTimersByTimeAsync(10 * 60_000)

      expect(mocks.toastError).toHaveBeenCalledWith(
        'The new session did not show up in its workspace.'
      )
      expect(useFloatingCreateLaunchStore.getState().startingTabIds[createTab.id]).toBeUndefined()
      expect(floatingTabsOf('create-session')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
