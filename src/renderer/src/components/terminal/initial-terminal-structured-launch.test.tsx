// @vitest-environment happy-dom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTerminalWatcherEffects } from '../use-terminal-watcher-effects'

const mocks = vi.hoisted(() => {
  const storeTabsByWorktree: Record<string, unknown[]> = {}
  const storeClosedRecords: Record<string, { worktreeId: string; closedAt: number }> = {}
  return {
    gate: vi.fn(),
    resume: vi.fn(),
    authority: 'none',
    launchStatus: vi.fn((_worktreeId: string, _provider: string): string => 'idle'),
    createTab: vi.fn(),
    storeTabsByWorktree,
    storeClosedRecords
  }
})
vi.mock('@/store', () => ({
  useAppStore: Object.assign(() => mocks.authority, {
    getState: () => ({
      activeWorktreeId: 'wt-1',
      tabsByWorktree: mocks.storeTabsByWorktree,
      closedTerminalTabTombstonesByTabId: mocks.storeClosedRecords,
      createTab: mocks.createTab
    })
  })
}))
vi.mock('@/lib/worktree-agent-activation-gate', () => ({
  gateWorktreeAgentActivation: mocks.gate
}))
vi.mock('@/lib/structured-agent-session-launch', () => ({
  hasStructuredAgentLaunchInWorktree: (worktreeId: string) =>
    ['claude', 'codex', 'grok'].some((agent) => mocks.launchStatus(worktreeId, agent) !== 'idle')
}))
vi.mock('@/lib/resume-sleeping-agent-session', () => ({
  resumeSleepingAgentSessionsForWorktree: mocks.resume
}))
vi.mock('@/lib/workspace-terminal-host-authority', () => ({
  createWorkspaceTerminalHostAuthoritySelector: () => () => 'none'
}))
vi.mock('../terminal-pane/terminal-parked-tab-watchers', () => ({
  pruneParkedTerminalWatchers: vi.fn(),
  terminalWatcherLiveWorkspaceIds: () => new Set(),
  syncParkedTerminalTabWatchersForWorkspaces: vi.fn(),
  disposeAllParkedTerminalWatchers: vi.fn()
}))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
afterEach(async () => {
  await act(async () => root?.unmount())
  vi.clearAllMocks()
  mocks.authority = 'none'
  mocks.storeTabsByWorktree = {}
  mocks.storeClosedRecords = {}
})

function Watcher({ restored = true, hydrated = false, worktreeId = 'wt-1' } = {}): null {
  useTerminalWatcherEffects({
    activeWorktreeId: worktreeId,
    workspaceSessionReady: true,
    terminalStartupRestorationReady: restored,
    hydrationSucceeded: hydrated,
    workspaceSurfaceIds: [],
    tabsByWorktree: {},
    activationDeferredMountTabIdsByWorktreeRef: { current: new Map() },
    activeTabId: null,
    activeTabIdByWorktree: {},
    activeView: 'terminal',
    activityTerminalPortals: [],
    anyMountedWorktreeHasLayout: false,
    backgroundMountRevision: 0,
    effectiveParkedTerminalWorktreeIds: new Set(),
    evictionExemptTerminalTabIds: new Set(),
    getEffectiveLayoutForWorktree: () => undefined,
    groupsByWorktree: {},
    measurableBackgroundWorktreeIdsRef: { current: new Set() },
    mountedWorktreeIdsRef: { current: new Set() },
    pairedRuntimeParkingEnvironmentIds: new Set(),
    pendingStartupByTabId: {},
    renderedActiveWorktreeId: worktreeId,
    startupTerminalTabHold: null,
    terminalParkingEnabled: false,
    terminalProviderSnapshotCapabilityRevision: 0,
    terminalSshParkingEnabled: false,
    terminalTitleSnapshotAuthorityEnabled: false
  })
  return null
}

function deferredGate(): (outcome: 'empty' | 'blocked') => Promise<void> {
  let finishGate!: (outcome: 'empty' | 'blocked') => void
  // One shared promise, as the gate's in-flight dedupe hands every rerun.
  mocks.gate.mockReturnValue(
    new Promise((resolve) => {
      finishGate = resolve
    })
  )
  return async (outcome) => act(async () => finishGate(outcome))
}

describe('an empty workspace after the activation check', () => {
  it.each([
    ['claude', 'pending'],
    ['codex', 'unknown'],
    ['claude', 'idle']
  ] as const)('gets no shell with a %s launch %s', async (agent, status) => {
    const finishGate = deferredGate()
    mocks.launchStatus.mockImplementation((_worktreeId, provider) =>
      provider === agent ? status : 'idle'
    )
    root = createRoot(document.createElement('div'))
    await act(async () => root?.render(<Watcher />))
    await finishGate('empty')
    expect(mocks.gate).toHaveBeenCalledWith('wt-1')
    expect(mocks.createTab).not.toHaveBeenCalled()
  })

  it('gets no shell for an empty row with no close record, which legacy data leaves', async () => {
    const finishGate = deferredGate()
    root = createRoot(document.createElement('div'))
    await act(async () => root?.render(<Watcher />))
    mocks.storeTabsByWorktree = { 'wt-1': [] }
    await finishGate('empty')
    expect(mocks.createTab).not.toHaveBeenCalled()
  })

  it('decides once after a StrictMode double run', async () => {
    const finishGate = deferredGate()
    const renderStrict = () =>
      root?.render(
        <StrictMode>
          <Watcher />
        </StrictMode>
      )
    root = createRoot(document.createElement('div'))
    await act(async () => renderStrict())
    await finishGate('empty')
    // The applied decision is final: a later run does not check again.
    await act(async () => renderStrict())
    expect(mocks.gate).toHaveBeenCalledTimes(2)
    expect(mocks.createTab).not.toHaveBeenCalled()
  })

  it('checks again after leaving and returning to a blocked workspace', async () => {
    mocks.gate.mockResolvedValue('blocked')
    root = createRoot(document.createElement('div'))
    await act(async () => root?.render(<Watcher />))
    await act(async () => root?.render(<Watcher worktreeId="wt-2" />))
    mocks.gate.mockResolvedValue('empty')
    await act(async () => root?.render(<Watcher />))
    expect(mocks.gate.mock.calls.map(([id]) => id)).toEqual(['wt-1', 'wt-2', 'wt-1'])
    expect(mocks.createTab).not.toHaveBeenCalled()
  })
})

describe('startup agent recovery host inventory', () => {
  it('keeps recovery available until the execution host answers', async () => {
    mocks.authority = 'unverifiable'
    mocks.gate.mockResolvedValue('adopted')
    root = createRoot(document.createElement('div'))
    await act(async () => root?.render(<Watcher hydrated />))
    expect(mocks.gate).not.toHaveBeenCalled()
    expect(mocks.resume).not.toHaveBeenCalled()
    mocks.authority = 'live'
    await act(async () => root?.render(<Watcher hydrated />))
    expect(mocks.gate).toHaveBeenCalledTimes(1)
    await act(async () => root?.render(<Watcher hydrated />))
    expect(mocks.gate).toHaveBeenCalledTimes(1)
  })

  it('waits for terminal restoration, then uses the activation gate', async () => {
    mocks.authority = 'live'
    mocks.gate.mockResolvedValue('adopted')
    root = createRoot(document.createElement('div'))
    await act(async () => root?.render(<Watcher hydrated restored={false} />))
    expect(mocks.resume).not.toHaveBeenCalled()
    expect(mocks.gate).not.toHaveBeenCalled()
    await act(async () => root?.render(<Watcher hydrated />))
    expect(mocks.gate).toHaveBeenCalledWith('wt-1')
    expect(mocks.resume).not.toHaveBeenCalled()
  })

  it.each(['blocked', 'rejected'])(
    'retries a %s startup after leaving and returning',
    async (outcome) => {
      mocks.authority = 'live'
      if (outcome === 'rejected') {
        mocks.gate.mockRejectedValue(new Error('host unavailable'))
      } else {
        mocks.gate.mockResolvedValue('blocked')
      }
      root = createRoot(document.createElement('div'))
      await act(async () => root?.render(<Watcher hydrated />))
      expect(mocks.gate).toHaveBeenCalledTimes(1)
      await act(async () => root?.render(<Watcher hydrated worktreeId="wt-2" />))
      mocks.gate.mockResolvedValue('adopted')
      await act(async () => root?.render(<Watcher hydrated />))
      expect(mocks.gate.mock.calls.map(([id]) => id)).toEqual(['wt-1', 'wt-2', 'wt-1'])
      expect(mocks.resume).not.toHaveBeenCalled()
    }
  )
})
