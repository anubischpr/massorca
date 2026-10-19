import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AgentStatusModule from '@/lib/agent-status'
import type * as RuntimeRpcClientModule from '@/runtime/runtime-rpc-client'
import { toRemoteRuntimePtyId } from '../../../../shared/remote-runtime-pty-id'
import { createTestStore, makeTab, makeWorktree, seedStore } from '../slices/store-test-helpers'
import { createStoreCascadesMockApi } from '../slices/store-cascades-test-harness'
import { closeTerminalTabConfirmingExit } from './terminal-tab-confirmed-close'

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}))

vi.mock('@/components/terminal-pane/pty-dispatcher', () => ({
  restorePtyDataHandlersAfterFailedShutdown: vi.fn(),
  unregisterPtyDataHandlers: vi.fn<() => unknown[]>(() => [])
}))

vi.mock('@/lib/agent-status', async (importOriginal) => ({
  ...(await importOriginal<typeof AgentStatusModule>()),
  detectAgentStatusFromTitle: vi.fn().mockReturnValue(null)
}))

const runtimeMocks = vi.hoisted(() => ({ callRuntimeRpc: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', async (importOriginal) => ({
  ...(await importOriginal<typeof RuntimeRpcClientModule>()),
  callRuntimeRpc: runtimeMocks.callRuntimeRpc
}))

const mockApi = createStoreCascadesMockApi()

const WORKTREE = 'repo::/tmp/app'
const LINK = { agent: 'claude' as const, providerSessionId: 'session-1', worktreeId: WORKTREE }

function storeWithTabs(ptyIds: string[]): ReturnType<typeof createTestStore> {
  const store = createTestStore()
  seedStore(store, {
    repos: [{ id: 'repo', path: '/tmp/app', name: 'app' }] as never,
    worktreesByRepo: {
      repo: [makeWorktree({ id: WORKTREE, repoId: 'repo', path: '/tmp/app' })]
    },
    tabsByWorktree: {
      [WORKTREE]: [
        makeTab({ id: 'tab-a', worktreeId: WORKTREE }),
        makeTab({ id: 'tab-b', worktreeId: WORKTREE })
      ]
    }
  })
  store.setState({ ptyIdsByTabId: { 'tab-a': ptyIds } } as never)
  return store
}

function openTabIds(store: ReturnType<typeof createTestStore>): string[] {
  return store.getState().tabsByWorktree[WORKTREE].map((tab) => tab.id)
}

describe('closeTerminalTabConfirmingExit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.worktrees.updateMeta.mockResolvedValue({})
    mockApi.pty.kill.mockResolvedValue({ exitConfirmed: true })
    runtimeMocks.callRuntimeRpc.mockResolvedValue({
      handle: 'handle-1',
      tabId: 'tab-a',
      ptyKilled: true,
      ptyExitConfirmed: true
    })
  })

  it('confirms when the local process confirms its exit, and removes the tab', async () => {
    const store = storeWithTabs(['pty-1'])

    await expect(closeTerminalTabConfirmingExit(store.getState(), 'tab-a')).resolves.toBe(true)

    expect(mockApi.pty.kill).toHaveBeenCalledTimes(1)
    expect(mockApi.pty.kill).toHaveBeenCalledWith('pty-1', { confirmExit: true })
    expect(openTabIds(store)).toEqual(['tab-b'])
  })

  it('does not confirm when the host reports the local process may still run', async () => {
    const store = storeWithTabs(['pty-1'])
    mockApi.pty.kill.mockResolvedValue({ exitConfirmed: false })

    await expect(closeTerminalTabConfirmingExit(store.getState(), 'tab-a')).resolves.toBe(false)
    expect(openTabIds(store)).toEqual(['tab-b'])
  })

  it('does not confirm when the local kill is rejected', async () => {
    const store = storeWithTabs(['pty-1'])
    mockApi.pty.kill.mockRejectedValue(new Error('pty gone'))

    await expect(closeTerminalTabConfirmingExit(store.getState(), 'tab-a')).resolves.toBe(false)
  })

  it('confirms only when every process of the tab confirmed', async () => {
    const store = storeWithTabs(['pty-1', 'pty-2'])
    mockApi.pty.kill.mockImplementation(async (ptyId: string) => ({
      exitConfirmed: ptyId === 'pty-1'
    }))

    await expect(closeTerminalTabConfirmingExit(store.getState(), 'tab-a')).resolves.toBe(false)
    expect(mockApi.pty.kill).toHaveBeenCalledTimes(2)
  })

  it('confirms a runtime terminal when the host reports the stop confirmed', async () => {
    const store = storeWithTabs([toRemoteRuntimePtyId('handle-1', 'env-1')])

    const exitConfirmed = await closeTerminalTabConfirmingExit(store.getState(), 'tab-a')

    expect(exitConfirmed).toBe(true)
    expect(runtimeMocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'terminal.close',
      { terminal: 'handle-1' }
    )
    expect(mockApi.pty.kill).not.toHaveBeenCalled()
  })

  it('does not confirm a runtime terminal the host omits the exit proof for', async () => {
    runtimeMocks.callRuntimeRpc.mockResolvedValue({
      handle: 'handle-1',
      tabId: 'tab-a',
      ptyKilled: true
    })
    const store = storeWithTabs([toRemoteRuntimePtyId('handle-1', 'env-1')])

    await expect(closeTerminalTabConfirmingExit(store.getState(), 'tab-a')).resolves.toBe(false)
  })

  it('does not confirm a runtime terminal whose close is rejected', async () => {
    runtimeMocks.callRuntimeRpc.mockRejectedValue(new Error('host offline'))
    const store = storeWithTabs([toRemoteRuntimePtyId('handle-1', 'env-1')])

    await expect(closeTerminalTabConfirmingExit(store.getState(), 'tab-a')).resolves.toBe(false)
  })

  it('does not confirm a tab that holds no process, and still removes it', async () => {
    const store = storeWithTabs([])

    await expect(closeTerminalTabConfirmingExit(store.getState(), 'tab-a')).resolves.toBe(false)
    expect(openTabIds(store)).toEqual(['tab-b'])
  })

  it('forgets the structured chat link of the closing tab only', () => {
    const store = storeWithTabs([])
    store.getState().linkStructuredChatTerminalTab('tab-a', LINK)
    store.getState().linkStructuredChatTerminalTab('tab-b', LINK)

    void closeTerminalTabConfirmingExit(store.getState(), 'tab-a')

    expect(store.getState().structuredChatTerminalLinksByTabId).toEqual({ 'tab-b': LINK })
  })

  it('keeps the ordinary close teardown unconfirmed and fire-and-forget', () => {
    const store = storeWithTabs(['pty-1'])

    store.getState().closeTab('tab-a')

    expect(mockApi.pty.kill).toHaveBeenCalledTimes(1)
    expect(mockApi.pty.kill).toHaveBeenCalledWith('pty-1')
    expect(openTabIds(store)).toEqual(['tab-b'])
  })
})
