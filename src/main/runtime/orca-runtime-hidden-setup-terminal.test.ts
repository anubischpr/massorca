// A chat-first create's setup runs on the host with no session tab; an ordinary create keeps its Setup tab.
import { describe, expect, it, vi, type Mock } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/constants'
import { OrcaRuntimeService } from './orca-runtime'
import type { RuntimeNotifier } from './runtime-notifier-contract'
import type { RuntimeStore } from './runtime-store-contract'
import type { TerminalWorkspaceLaunchScope } from './runtime-legacy-worker-terminal-recovery-types'
import { provisionWorktreeTerminals } from './runtime-worktree-terminal-provisioning'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') }
}))

const WORKTREE_ID = 'wt-1'
const SELECTOR = `id:${WORKTREE_ID}`
const SETUP = { runnerScriptPath: '/worktrees/app/setup.sh', envVars: {} }

class ProvisioningRuntime extends OrcaRuntimeService {
  protected override async resolveTerminalWorkspaceLaunchScope(): Promise<TerminalWorkspaceLaunchScope> {
    return {
      id: WORKTREE_ID,
      path: '/worktrees/app',
      connectionId: null,
      repo: null,
      folderWorkspace: null
    }
  }

  provisioningHost() {
    return this.getWorktreeTerminalProvisioningHost()
  }
}

// Why: provisioning reads the setup launch mode from the store; the default mode is the new tab.
function storeWithSettings(): RuntimeStore {
  return {
    getRepos: () => [],
    getRepo: () => undefined,
    addRepo: vi.fn<RuntimeStore['addRepo']>(),
    updateRepo: vi.fn<RuntimeStore['updateRepo']>(),
    getAllWorktreeMeta: () => ({}),
    getWorktreeMeta: () => undefined,
    setWorktreeMeta: vi.fn<RuntimeStore['setWorktreeMeta']>(),
    removeWorktreeMeta: vi.fn<RuntimeStore['removeWorktreeMeta']>(),
    getGitHubCache: vi.fn<RuntimeStore['getGitHubCache']>(),
    getWorkspaceSession: () => getDefaultWorkspaceSession(),
    setWorkspaceSession: () => undefined,
    getSettings: () => ({
      workspaceDir: '/workspaces',
      nestWorkspaces: false,
      refreshLocalBaseRefOnWorktreeCreate: false,
      branchPrefix: 'none',
      branchPrefixCustom: '',
      setupScriptLaunchMode: 'new-tab'
    })
  }
}

function notifierWithReveal(revealTerminalSession: Mock): RuntimeNotifier {
  return {
    worktreesChanged: vi.fn(),
    reposChanged: vi.fn(),
    activateWorktree: vi.fn(),
    createTerminal: vi.fn(),
    splitTerminal: vi.fn(),
    renameTerminal: vi.fn(),
    focusTerminal: vi.fn(),
    closeTerminal: vi.fn(),
    sleepWorktree: vi.fn(),
    terminalFitOverrideChanged: vi.fn(),
    terminalDriverChanged: vi.fn(),
    revealTerminalSession
  }
}

function runtimeWithSpawns() {
  let spawned = 0
  const runtime = new ProvisioningRuntime(storeWithSettings())
  const spawn = vi.fn(async () => ({ id: `pty-${(spawned += 1)}` }))
  const revealTerminalSession = vi.fn()
  runtime.setPtyController({
    spawn,
    write: () => true,
    kill: () => true,
    getForegroundProcess: async () => null
  })
  runtime.setNotifier(notifierWithReveal(revealTerminalSession))
  return { runtime, spawn, revealTerminalSession }
}

function provisionSetup(runtime: ProvisioningRuntime, chatFirst: boolean) {
  return provisionWorktreeTerminals(runtime.provisioningHost(), {
    worktreeSelector: SELECTOR,
    worktreeId: WORKTREE_ID,
    worktreePath: '/worktrees/app',
    setup: SETUP,
    primaryTerminalHandle: null,
    hasStartupTerminal: false,
    setupCommandPlatform: 'posix',
    ...(chatFirst ? { setupPresentation: 'chat-background-task' as const } : {})
  })
}

async function terminalTitles(runtime: ProvisioningRuntime): Promise<(string | null)[]> {
  const { tabs } = await runtime.listMobileSessionTabs(SELECTOR)
  return tabs.map((tab) => (tab.type === 'terminal' ? tab.title : null))
}

describe('a setup a chat-first create hides on the host', () => {
  it('runs the setup with no session tab: no publish, no reveal, no saved binding', async () => {
    const { runtime, spawn, revealTerminalSession } = runtimeWithSpawns()
    await expect(provisionSetup(runtime, true)).resolves.toMatchObject({ setupSpawned: true })
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.stringContaining('setup.sh'),
        persistHostSessionBinding: false
      })
    )
    expect(revealTerminalSession).not.toHaveBeenCalled()
    expect(await terminalTitles(runtime)).toEqual([])
  })

  it('publishes the setup of an ordinary create as its only tab', async () => {
    const { runtime, spawn, revealTerminalSession } = runtimeWithSpawns()
    await provisionSetup(runtime, false)
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith(expect.objectContaining({ persistHostSessionBinding: true }))
    expect(revealTerminalSession).toHaveBeenCalledTimes(1)
    expect(await terminalTitles(runtime)).toEqual(['Setup'])
  })
})
