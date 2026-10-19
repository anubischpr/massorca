import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocalRuntimeCapabilitiesForTests } from '@/runtime/local-runtime-capabilities'

const mockCreateTab = vi.fn()
const mockQueueTabStartupCommand = vi.fn()
const mockSetActiveTabType = vi.fn()
const mockSetTabViewMode = vi.fn()
const mockSetTabBarOrder = vi.fn()
const mockSetAgentStatus = vi.fn()
const mockPasteDraftWhenAgentReady = vi.fn()
const mockSeedNativeChatLaunchPrompt = vi.fn()
const mockSeedNativeChatLaunchDraft = vi.fn()
const mockMarkNativeChatLaunchPromptFailed = vi.fn()
const mockTrack = vi.fn()
const mockToastMessage = vi.fn()
const mockWaitForAgentReady = vi.fn()

type TestSettings = {
  agentCmdOverrides: Partial<Record<string, string>>
  agentDefaultArgs: Record<string, string>
  agentDefaultEnv: Record<string, Record<string, string>>
  activeRuntimeEnvironmentId: string | null
}

type TestWorktree = {
  id: string
  repoId: string
  projectId: string
  path: string
  displayName: string
}

// Why: only the fields the new-tab launch reads are typed; the mocks are reached through the store.
type TestStore = {
  activeRepoId: string
  activeWorktreeId: string
  settings: TestSettings
  projects: { id: string; localWindowsRuntimePreference: { kind: 'inherit-global' } }[]
  repos: { id: string; connectionId: string | null; path: string }[]
  sshConnectionStates: Map<string, { status: string }>
  transientClearedAgentStatusConnectionIds: Record<string, true>
  worktreesByRepo: Record<string, TestWorktree[]>
  allWorktrees: () => TestWorktree[]
  tabsByWorktree: Record<string, { id: string }[]>
  openFiles: { id: string; worktreeId: string }[]
  browserTabsByWorktree: Record<string, { id: string }[]>
  tabBarOrderByWorktree: Record<string, string[]>
  terminalLayoutsByTabId: Record<string, { activeLeafId: string | null }>
  ptyIdsByTabId: Record<string, string[]>
  createTab: unknown
  closeTab: unknown
  queueTabStartupCommand: unknown
  setActiveTabType: unknown
  setTabViewMode: unknown
  setTabBarOrder: unknown
  setAgentStatus: unknown
  seedNativeChatLaunchPrompt: unknown
  seedNativeChatLaunchDraft: unknown
  markNativeChatLaunchPromptFailed: unknown
}

const store: TestStore = {
  activeRepoId: 'repo-1',
  activeWorktreeId: 'wt-1',
  settings: {
    agentCmdOverrides: {},
    agentDefaultArgs: {},
    agentDefaultEnv: {},
    activeRuntimeEnvironmentId: null
  },
  projects: [{ id: 'repo-1', localWindowsRuntimePreference: { kind: 'inherit-global' } }],
  repos: [{ id: 'repo-1', connectionId: null, path: '/repo' }],
  sshConnectionStates: new Map([['ssh-a', { status: 'connected' }]]),
  transientClearedAgentStatusConnectionIds: {},
  worktreesByRepo: {
    'repo-1': [
      {
        id: 'wt-1',
        repoId: 'repo-1',
        projectId: 'repo-1',
        path: '/repo/worktree',
        displayName: 'main'
      }
    ]
  },
  allWorktrees: () => store.worktreesByRepo['repo-1'] ?? [],
  tabsByWorktree: { 'wt-1': [{ id: 'tab-1' }] },
  openFiles: [],
  browserTabsByWorktree: {},
  tabBarOrderByWorktree: {},
  terminalLayoutsByTabId: {},
  ptyIdsByTabId: {},
  createTab: mockCreateTab,
  closeTab: vi.fn(),
  queueTabStartupCommand: mockQueueTabStartupCommand,
  setActiveTabType: mockSetActiveTabType,
  setTabViewMode: mockSetTabViewMode,
  setTabBarOrder: mockSetTabBarOrder,
  setAgentStatus: mockSetAgentStatus,
  seedNativeChatLaunchPrompt: mockSeedNativeChatLaunchPrompt,
  seedNativeChatLaunchDraft: mockSeedNativeChatLaunchDraft,
  markNativeChatLaunchPromptFailed: mockMarkNativeChatLaunchPromptFailed
}

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => store
  }
}))

const mockToastError = vi.fn()
const mockToastWarning = vi.fn()

vi.mock('sonner', () => ({
  toast: { message: mockToastMessage, error: mockToastError, warning: mockToastWarning }
}))

vi.mock('@/components/tab-bar/reconcile-order', () => ({
  reconcileTabOrder: vi.fn(
    (_stored, termIds: string[], editorIds: string[], browserIds: string[]) => [
      ...termIds,
      ...editorIds,
      ...browserIds
    ]
  )
}))

vi.mock('@/lib/agent-paste-draft', () => ({
  pasteDraftWhenAgentReady: mockPasteDraftWhenAgentReady
}))

// Why: this file pins main's window launch and its paste, which chat-default and paired launches
// still take; an AI button's host launch reuses that paste and is pinned in its own tests.
vi.mock('@/lib/launch-agent-new-tab-host-route', () => ({
  newTabPromptLaunchesThroughHost: () => false,
  launchNewTabPromptThroughHost: vi.fn()
}))

vi.mock('@/lib/agent-ready-wait', () => ({
  waitForAgentReady: mockWaitForAgentReady
}))

vi.mock('@/lib/telemetry', () => ({
  track: mockTrack,
  tuiAgentToAgentKind: (agent: string) => agent
}))

const mockCreateWebRuntimeSessionTerminal = vi.fn()
const mockCreateWebRuntimeAgentSessionTerminalWithLaunchDraft = vi.fn()
const mockIsWebRuntimeSessionActive = vi.fn(() => false)

vi.mock('@/runtime/web-runtime-session', () => ({
  createWebRuntimeSessionTerminal: mockCreateWebRuntimeSessionTerminal,
  createWebRuntimeAgentSessionTerminalWithLaunchDraft:
    mockCreateWebRuntimeAgentSessionTerminalWithLaunchDraft,
  isWebRuntimeSessionActive: mockIsWebRuntimeSessionActive,
  isWebTerminalSurfaceTabId: vi.fn(() => false)
}))

const LOCAL_TARGET = { kind: 'local' as const }
const mockAskHostCreateSupport = vi.fn()
const mockResolveStructuredAgentSessionOwner = vi.fn<() => string | null>(() => 'local')

vi.mock('@/lib/structured-agent-session-host-admission', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  askHostCreateSupport: (...args: unknown[]) => mockAskHostCreateSupport(...args)
}))

vi.mock('@/runtime/structured-agent-session-owner', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveStructuredAgentSessionOwner: () => mockResolveStructuredAgentSessionOwner(),
  structuredAgentSessionTargetForHost: () => LOCAL_TARGET
}))

describe('launchAgentInNewTab for Pi on the host that runs the terminal', () => {
  const PI_TERMINAL_VERDICT = {
    route: 'terminal-tui' as const,
    requestId: 'pi-click',
    agent: 'pi' as const,
    worktreeId: 'wt-1'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setLocalRuntimeCapabilitiesForTests([])
    store.settings = {
      agentCmdOverrides: {},
      agentDefaultArgs: {},
      agentDefaultEnv: {},
      activeRuntimeEnvironmentId: null
    }
    store.activeRepoId = 'repo-1'
    store.activeWorktreeId = 'wt-1'
    store.projects = [{ id: 'repo-1', localWindowsRuntimePreference: { kind: 'inherit-global' } }]
    store.repos = [{ id: 'repo-1', connectionId: null, path: '/repo' }]
    store.transientClearedAgentStatusConnectionIds = {}
    store.worktreesByRepo = {
      'repo-1': [
        {
          id: 'wt-1',
          repoId: 'repo-1',
          projectId: 'repo-1',
          path: '/repo/worktree',
          displayName: 'main'
        }
      ]
    }
    store.tabsByWorktree = { 'wt-1': [{ id: 'tab-1' }] }
    store.tabBarOrderByWorktree = {}
    store.terminalLayoutsByTabId = {}
    store.ptyIdsByTabId = {}
    mockCreateTab.mockReturnValue({ id: 'tab-1' })
    mockPasteDraftWhenAgentReady.mockResolvedValue(true)
    mockWaitForAgentReady.mockResolvedValue({ ready: true, reason: 'foreground-match' })
    mockResolveStructuredAgentSessionOwner.mockReturnValue('local')
    mockAskHostCreateSupport.mockResolvedValue({ kind: 'admitted' })
  })

  function hostAnswers(piRuntime: 'pi' | 'gentle-shell' | 'cliMissing' | 'unknown') {
    mockAskHostCreateSupport.mockResolvedValue(
      piRuntime === 'cliMissing'
        ? { kind: 'declined', cause: 'cliMissing' }
        : piRuntime === 'unknown'
          ? { kind: 'declined' }
          : piRuntime === 'gentle-shell'
            ? { kind: 'admitted', seedOptions: { piRuntime: 'gentle-shell' } }
            : { kind: 'admitted' }
    )
  }

  async function launchPiTerminal() {
    const { adoptAgentSessionLaunchVerdict } = await import('./agent-session-launch-plan')
    const { launchAgentInNewTab } = await import('./launch-agent-in-new-tab')
    return launchAgentInNewTab({
      agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict(PI_TERMINAL_VERDICT),
      agent: 'pi',
      worktreeId: 'wt-1'
    })
  }

  async function expectQueuedPiCommand(pattern: RegExp): Promise<void> {
    await vi.waitFor(() =>
      expect(mockQueueTabStartupCommand).toHaveBeenCalledWith(
        'tab-1',
        expect.objectContaining({ command: expect.stringMatching(pattern) })
      )
    )
  }

  it('launches Gentle Shell when the host has only Gentle Shell', async () => {
    hostAnswers('gentle-shell')

    const result = await launchPiTerminal()

    expect(result?.surface).toEqual({ kind: 'host-published' })
    expect(mockAskHostCreateSupport).toHaveBeenCalledWith(LOCAL_TARGET, 'wt-1', 'pi')
    await expectQueuedPiCommand(/^gentle-shell(\s|$)/)
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('launches stock pi when the host has stock pi', async () => {
    hostAnswers('pi')

    await launchPiTerminal()

    await expectQueuedPiCommand(/^pi(\s|$)/)
  })

  it('honors an explicit client Pi command without asking the host', async () => {
    store.settings.agentCmdOverrides = { pi: '/opt/pi --fast' }

    await launchPiTerminal()

    await expectQueuedPiCommand(/^\/opt\/pi --fast/)
    expect(mockAskHostCreateSupport).not.toHaveBeenCalled()
  })

  it('shows the missing-Pi notice and opens no tab when neither runtime is installed', async () => {
    hostAnswers('cliMissing')

    await launchPiTerminal()

    await vi.waitFor(() => expect(mockToastError).toHaveBeenCalledOnce())
    expect(mockCreateTab).not.toHaveBeenCalled()
    expect(mockQueueTabStartupCommand).not.toHaveBeenCalled()
  })

  it('keeps the stock command when the host did not answer', async () => {
    hostAnswers('unknown')

    await launchPiTerminal()

    await expectQueuedPiCommand(/^pi(\s|$)/)
  })

  it('keeps the stock command without asking when no runtime serves the terminal host', async () => {
    mockResolveStructuredAgentSessionOwner.mockReturnValue(null)

    await launchPiTerminal()

    expect(mockAskHostCreateSupport).not.toHaveBeenCalled()
    expect(mockCreateTab).toHaveBeenCalledOnce()
    expect(mockQueueTabStartupCommand).toHaveBeenCalledWith(
      'tab-1',
      expect.objectContaining({ command: expect.stringMatching(/^pi(\s|$)/) })
    )
  })
})
