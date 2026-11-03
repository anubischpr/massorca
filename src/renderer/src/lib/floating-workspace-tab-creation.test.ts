import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import {
  type KnownRuntimeEnvironment,
  redactRuntimeEnvironment
} from '../../../shared/runtime-environments'
import {
  createTestStore,
  makeRuntimeOwnedWorktree,
  makeTabGroup,
  seedStore
} from '../store/slices/store-test-helpers'
import { selectReferencedSessions } from '../store/slices/tabs/pane-session-ref'
import {
  FLOATING_HOST_NO_WORKSPACE_REASON,
  FLOATING_HOST_THIS_COMPUTER
} from './floating-workspace-host'
import { useFloatingWorkspaceHostStore } from './floating-workspace-host-store'
import { createFloatingWorkspaceTerminalTab } from './floating-workspace-tab-creation'

// Why: the creation helper reads the live app store, so the mock forwards to the test store below.
const liveApp = vi.hoisted((): { store: { getState(): unknown } | undefined } => ({
  store: undefined
}))

vi.mock('@/store', () => ({
  useAppStore: { getState: () => liveApp.store?.getState() }
}))
vi.mock('./focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const FLOATING = FLOATING_TERMINAL_WORKTREE_ID
const OWNER = 'repo-a::/srv/owner'
const VPS = 'env-vps'
const EMPTY_HOST = 'env-empty'
const store = createTestStore()

function pairedEnvironment(id: string, name: string): ReturnType<typeof redactRuntimeEnvironment> {
  const endpoint: KnownRuntimeEnvironment['endpoints'][number] = {
    id: `${id}-ws`,
    kind: 'websocket',
    label: 'WebSocket',
    endpoint: 'wss://host.example:8787',
    deviceToken: 'test-device-token',
    publicKeyB64: 'test-public-key'
  }
  return redactRuntimeEnvironment({
    id,
    name,
    createdAt: 1,
    updatedAt: 1,
    pairingRevision: 1,
    lastUsedAt: 1,
    runtimeId: `${id}-runtime`,
    source: 'manual',
    endpoints: [endpoint],
    preferredEndpointId: endpoint.id
  })
}

beforeEach(() => {
  liveApp.store = store
  vi.mocked(toast.error).mockClear()
  useFloatingWorkspaceHostStore.setState({ chosen: null, lastUsedHost: null })
  seedStore(store, {
    activeWorktreeId: OWNER,
    runtimeEnvironments: [pairedEnvironment(VPS, 'VPS'), pairedEnvironment(EMPTY_HOST, 'Empty')],
    worktreesByRepo: {
      'repo-a': [makeRuntimeOwnedWorktree({ id: OWNER, repoId: 'repo-a', lastActivityAt: 10 }, VPS)]
    },
    tabsByWorktree: { [OWNER]: [], [FLOATING]: [] },
    unifiedTabsByWorktree: { [OWNER]: [], [FLOATING]: [] },
    groupsByWorktree: {
      [OWNER]: [
        makeTabGroup({ id: 'owner-main', worktreeId: OWNER, tabOrder: [], activeTabId: null })
      ],
      [FLOATING]: [
        makeTabGroup({ id: 'float-main', worktreeId: FLOATING, tabOrder: [], activeTabId: null })
      ]
    },
    activeGroupIdByWorktree: { [OWNER]: 'owner-main', [FLOATING]: 'float-main' },
    layoutByWorktree: {
      [OWNER]: { type: 'leaf', groupId: 'owner-main' },
      [FLOATING]: { type: 'leaf', groupId: 'float-main' }
    }
  })
})

describe('creating a floating terminal on the selected host', () => {
  it('creates the terminal in the floating workspace when This computer is selected', async () => {
    useFloatingWorkspaceHostStore.setState({ chosen: FLOATING_HOST_THIS_COMPUTER })

    const tab = await createFloatingWorkspaceTerminalTab(store.getState())

    expect(tab).not.toBeNull()
    expect(store.getState().tabsByWorktree[FLOATING]?.map((entry) => entry.id)).toEqual([tab?.id])
    expect(store.getState().tabsByWorktree[OWNER]).toEqual([])
    expect(selectReferencedSessions(store.getState()).size).toBe(0)
  })

  it('creates the terminal in the selected host workspace and shows it in the floating pane', async () => {
    useFloatingWorkspaceHostStore.setState({ chosen: VPS })

    const tab = await createFloatingWorkspaceTerminalTab(store.getState())

    expect(tab).not.toBeNull()
    expect(store.getState().tabsByWorktree[OWNER]?.map((entry) => entry.id)).toEqual([tab?.id])
    expect(store.getState().tabsByWorktree[FLOATING]).toEqual([])
    expect(selectReferencedSessions(store.getState()).get(tab?.id ?? '')).toMatchObject({
      ownerWorktreeId: OWNER,
      layoutWorktreeId: FLOATING
    })
  })

  it('reports the reason and creates nothing when the selected host has no workspace', async () => {
    useFloatingWorkspaceHostStore.setState({ chosen: EMPTY_HOST })

    const tab = await createFloatingWorkspaceTerminalTab(store.getState())

    expect(tab).toBeNull()
    expect(toast.error).toHaveBeenCalledWith(FLOATING_HOST_NO_WORKSPACE_REASON)
    expect(store.getState().tabsByWorktree[OWNER]).toEqual([])
    expect(store.getState().tabsByWorktree[FLOATING]).toEqual([])
  })
})
