// A fresh terminal for a chat with no provider session yet starts the agent's own command, never a resume.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PiRuntimeSelection } from '../../../shared/pi-runtime-selection'
import type { TuiAgent } from '../../../shared/tui-agent'

const mockCreateTab = vi.fn()
const mockPersistOrder = vi.fn()
const mockSetActiveTabType = vi.fn()

const settingsDefaults: {
  agentCmdOverrides: Record<string, string>
  agentDefaultArgs: Record<string, string>
  agentDefaultEnv: Record<string, Record<string, string>>
} = { agentCmdOverrides: {}, agentDefaultArgs: {}, agentDefaultEnv: {} }

const store = {
  settings: {
    ...settingsDefaults,
    activeRuntimeEnvironmentId: null,
    terminalWindowsShell: undefined
  },
  repos: [{ id: 'repo-1', connectionId: null, path: '/home/neil/repo' }],
  worktreesByRepo: {
    'repo-1': [{ id: 'wt-1', repoId: 'repo-1', path: '/home/neil/repo/feature', displayName: 'f' }]
  },
  getKnownWorktreeById: (id: string) =>
    id === 'wt-1' ? { id: 'wt-1', repoId: 'repo-1', path: '/home/neil/repo/feature' } : undefined,
  openFiles: [],
  browserTabsByWorktree: {},
  tabBarOrderByWorktree: {},
  createTab: mockCreateTab,
  setActiveTabType: mockSetActiveTabType
}

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))
vi.mock('@/lib/new-workspace', () => ({ CLIENT_PLATFORM: 'linux' }))
vi.mock('sonner', () => ({ toast: { message: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/telemetry', () => ({
  track: vi.fn(),
  tuiAgentToAgentKind: (agent: string) => agent
}))
vi.mock('@/lib/launch-agent-tab-order', () => ({ persistAgentLaunchTabOrder: mockPersistOrder }))
vi.mock('@/components/tab-bar/reconcile-order', () => ({
  reconcileTabOrder: vi.fn((_stored, termIds: string[]) => [...termIds])
}))

type PendingStartup = { command?: string; resumeProviderSession?: unknown }

function lastPendingStartup(): PendingStartup {
  const options: unknown = mockCreateTab.mock.calls.at(-1)?.[3]
  if (typeof options !== 'object' || options === null || !('pendingStartup' in options)) {
    return {}
  }
  const startup = options.pendingStartup
  return typeof startup === 'object' && startup !== null ? startup : {}
}

async function freshCommand(request: {
  worktreeId: string
  agent: TuiAgent
  piRuntime?: PiRuntimeSelection
}): Promise<string> {
  const { launchFreshAgentSession } = await import('./sleeping-agent-session-launch')
  expect(launchFreshAgentSession(request)).toBe(true)
  return lastPendingStartup().command ?? ''
}

describe('launchFreshAgentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.settings.agentCmdOverrides = {}
    store.settings.agentDefaultArgs = {}
    store.settings.agentDefaultEnv = {}
    mockCreateTab.mockReturnValue({ id: 'tab-2' })
  })

  it.each([
    ['claude', 'claude'],
    ['codex', 'codex'],
    ['antigravity', 'agy']
  ] as const)(
    'starts a fresh %s session in the chat worktree, without any resume',
    async (agent, binary) => {
      const command = await freshCommand({ worktreeId: 'wt-1', agent })

      expect(command.startsWith(binary)).toBe(true)
      expect(command).not.toMatch(/--resume|--session|resume/)
      expect(lastPendingStartup().resumeProviderSession).toBeUndefined()
      expect(mockCreateTab.mock.calls.at(-1)?.[0]).toBe('wt-1')
    }
  )

  it('starts stock pi for a stock Pi chat', async () => {
    expect(await freshCommand({ worktreeId: 'wt-1', agent: 'pi', piRuntime: 'pi' })).toBe('pi')
  })

  it('starts gentle-shell, never stock pi, for a Gentle Shell chat', async () => {
    expect(await freshCommand({ worktreeId: 'wt-1', agent: 'pi', piRuntime: 'gentle-shell' })).toBe(
      'gentle-shell'
    )
  })

  it('starts gentle-shell for a Gentle Shell chat whose client names no Pi command', async () => {
    store.settings.agentCmdOverrides = {}

    expect(await freshCommand({ worktreeId: 'wt-1', agent: 'pi', piRuntime: 'gentle-shell' })).toBe(
      'gentle-shell'
    )
  })

  it('starts stock pi for a stock Pi chat even when the client Pi command names Gentle Shell', async () => {
    store.settings.agentCmdOverrides = { pi: 'gentle-shell' }

    expect(await freshCommand({ worktreeId: 'wt-1', agent: 'pi', piRuntime: 'pi' })).toBe('pi')
  })

  it('honors the client Pi command for a chat whose session names no runtime', async () => {
    store.settings.agentCmdOverrides = { pi: 'gentle-shell' }

    expect(await freshCommand({ worktreeId: 'wt-1', agent: 'pi' })).toBe('gentle-shell')
  })

  it('starts the configured Gentle Shell command for a Gentle Shell chat', async () => {
    store.settings.agentCmdOverrides = { pi: '/opt/gentle/gentle-shell' }

    expect(await freshCommand({ worktreeId: 'wt-1', agent: 'pi', piRuntime: 'gentle-shell' })).toBe(
      '/opt/gentle/gentle-shell'
    )
  })

  it('reports the new tab and activates the terminal view', async () => {
    const { launchFreshAgentSession } = await import('./sleeping-agent-session-launch')
    const onSessionLaunched = vi.fn()

    expect(
      launchFreshAgentSession({ worktreeId: 'wt-1', agent: 'codex' }, { onSessionLaunched })
    ).toBe(true)

    expect(onSessionLaunched).toHaveBeenCalledWith('tab-2')
    expect(mockSetActiveTabType).toHaveBeenCalledWith('terminal', 'wt-1')
    expect(mockPersistOrder).toHaveBeenCalledWith('wt-1', 'tab-2')
  })
})
