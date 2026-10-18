// The terminal view's resume must launch the chat's own Pi runtime command (Gentle Shell or stock pi).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../shared/agent-session-resume'

const mockCreateTab = vi.fn()

type TestWorktree = { id: string; repoId: string; path: string; displayName: string }
const agentCmdOverrides: Record<string, string> = {}
const agentDefaultArgs: Record<string, string> = {}
const agentDefaultEnv: Record<string, Record<string, string>> = {}
const activeRuntimeEnvironmentId: string | null = null
const terminalWindowsShell: string | undefined = undefined
const repoConnectionId: string | null = null
const worktreesByRepo: Record<string, TestWorktree[]> = {
  'repo-1': [{ id: 'wt-1', repoId: 'repo-1', path: '/home/neil/repo/feature', displayName: 'f' }]
}
const openFiles: { id: string; worktreeId: string }[] = []
const browserTabsByWorktree: Record<string, { id: string }[]> = {}
const tabBarOrderByWorktree: Record<string, string[]> = {}

const store = {
  settings: {
    agentCmdOverrides,
    agentDefaultArgs,
    agentDefaultEnv,
    activeRuntimeEnvironmentId,
    terminalWindowsShell
  },
  repos: [{ id: 'repo-1', connectionId: repoConnectionId, path: '/home/neil/repo' }],
  worktreesByRepo,
  getKnownWorktreeById: (id: string) =>
    Object.values(store.worktreesByRepo)
      .flat()
      .find((worktree) => worktree.id === id),
  tabsByWorktree: { 'wt-1': [{ id: 'tab-1' }] },
  openFiles,
  browserTabsByWorktree,
  tabBarOrderByWorktree,
  createTab: mockCreateTab,
  claimAutomaticAgentResume: vi.fn(),
  clearSleepingAgentSession: vi.fn(),
  setActiveTabType: vi.fn(),
  setTabBarOrder: vi.fn()
}

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))
vi.mock('@/lib/new-workspace', () => ({ CLIENT_PLATFORM: 'linux' }))
vi.mock('sonner', () => ({ toast: { message: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/telemetry', () => ({
  track: vi.fn(),
  tuiAgentToAgentKind: (agent: string) => agent
}))
vi.mock('@/components/tab-bar/reconcile-order', () => ({
  reconcileTabOrder: vi.fn((_stored, termIds: string[]) => [...termIds])
}))

const TRANSCRIPT = '/home/neil/.pi/agent/sessions/session-1.jsonl'

const record: SleepingAgentSessionRecord = {
  paneKey: 'tab-1::leaf-1',
  tabId: 'tab-1',
  worktreeId: 'wt-1',
  agent: 'pi',
  providerSession: { key: 'session_id', id: 'session-1', transcriptPath: TRANSCRIPT },
  prompt: '',
  state: 'done',
  capturedAt: 1,
  updatedAt: 1
}

async function launchedCommand(sessionRecord: SleepingAgentSessionRecord): Promise<string> {
  const { launchSleepingAgentSession } = await import('./sleeping-agent-session-launch')
  expect(launchSleepingAgentSession(sessionRecord)).toBe(true)
  const options: unknown = mockCreateTab.mock.calls.at(-1)?.[3]
  return pendingStartupCommand(options)
}

function pendingStartupCommand(options: unknown): string {
  if (typeof options !== 'object' || options === null || !('pendingStartup' in options)) {
    return ''
  }
  const startup = options.pendingStartup
  if (typeof startup !== 'object' || startup === null || !('command' in startup)) {
    return ''
  }
  return typeof startup.command === 'string' ? startup.command : ''
}

describe('launchSleepingAgentSession for Pi runtimes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.settings = {
      agentCmdOverrides: {},
      agentDefaultArgs: {},
      agentDefaultEnv: {},
      activeRuntimeEnvironmentId: null,
      terminalWindowsShell: undefined
    }
    mockCreateTab.mockReturnValue({ id: 'tab-2' })
  })

  it('resumes a stock pi chat through pi', async () => {
    expect(await launchedCommand({ ...record, piRuntime: 'pi' })).toBe(
      `pi '--session' '${TRANSCRIPT}'`
    )
  })

  it('resumes a Gentle Shell chat through gentle-shell with pi args after --', async () => {
    expect(await launchedCommand({ ...record, piRuntime: 'gentle-shell' })).toBe(
      `gentle-shell '--' '--session' '${TRANSCRIPT}'`
    )
  })

  it('resumes a Gentle Shell chat through the configured Gentle Shell command', async () => {
    store.settings.agentCmdOverrides = { pi: '/opt/gentle/gentle-shell' }
    expect(await launchedCommand({ ...record, piRuntime: 'gentle-shell' })).toBe(
      `/opt/gentle/gentle-shell '--' '--session' '${TRANSCRIPT}'`
    )
  })
})
