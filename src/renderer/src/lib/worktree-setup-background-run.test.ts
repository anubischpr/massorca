// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import {
  makeCreatedAgentWorktree,
  seedEmptyActivatableWorktree
} from '@/lib/worktree-activation-created-agent-test-state'
import type { WorktreeSetupLaunch } from '../../../shared/worktree/launch-types'

const mocks = vi.hoisted(() => ({
  activateAndRevealWorkspace: vi.fn(() => ({ primaryTabId: null }))
}))

// Why: activation and the runtime owner are the only parts faked; tab creation runs through the real store.
vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorkspace: mocks.activateAndRevealWorkspace
}))
vi.mock('@/runtime/runtime-rpc-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getActiveRuntimeTarget: () => ({ kind: 'local' })
}))

import {
  launchWorktreeSetupBackgroundRun,
  revealWorktreeSetupRun,
  routeCreateSetup
} from './worktree-setup-background-run'

const initialAppStoreState = useAppStore.getState()
const worktree = makeCreatedAgentWorktree()
const setup: WorktreeSetupLaunch = {
  runnerScriptPath: '/workspace/.orca/setup-runner.sh',
  envVars: { ORCA_SETUP_TEST: '1' }
}

function terminalTabs(): { ptyId: string | null; customTitle: string | null; id: string }[] {
  return useAppStore.getState().tabsByWorktree[worktree.id] ?? []
}

beforeEach(() => {
  seedEmptyActivatableWorktree(worktree)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      pty: {
        spawn: vi.fn(async () => ({ id: 'pty-setup' })),
        kill: vi.fn(async () => undefined)
      },
      worktreeSetupRuns: { register: vi.fn(async () => ({ ok: true })) }
    }
  })
})

afterEach(() => {
  Reflect.deleteProperty(window, 'api')
  useAppStore.setState(initialAppStoreState, true)
  mocks.activateAndRevealWorkspace.mockClear()
  vi.restoreAllMocks()
})

describe('launchWorktreeSetupBackgroundRun', () => {
  it('starts the setup in a PTY with no tab and registers it with main', async () => {
    const ptyId = await launchWorktreeSetupBackgroundRun({ worktree, setup })

    expect(ptyId).toBe('pty-setup')
    expect(window.api.pty.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: worktree.path,
        worktreeId: worktree.id,
        connectionId: null,
        command: expect.stringContaining(setup.runnerScriptPath),
        env: expect.objectContaining({ ORCA_SETUP_TEST: '1', ORCA_WORKTREE_ID: worktree.id })
      })
    )
    expect(window.api.worktreeSetupRuns.register).toHaveBeenCalledWith({
      ptyId: 'pty-setup',
      worktreeId: worktree.id
    })
    // Why: the setup PTY has no tab record, so the strip cannot show it.
    expect(terminalTabs()).toHaveLength(0)
  })

  it('spawns on the repo SSH connection so the setup runs on the workspace host', async () => {
    const repos = useAppStore.getState().repos.map((repo) => ({ ...repo, connectionId: 'ssh-1' }))
    useAppStore.setState({ repos })

    await launchWorktreeSetupBackgroundRun({ worktree, setup })

    expect(window.api.pty.spawn).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'ssh-1' })
    )
  })

  it('kills the PTY and rethrows when main refuses the registration', async () => {
    window.api.worktreeSetupRuns.register = vi.fn(async () => {
      throw new Error('refused')
    })

    await expect(launchWorktreeSetupBackgroundRun({ worktree, setup })).rejects.toThrow('refused')
    // Why: an unregistered setup PTY would be swept on the next reload with no row to stop it.
    expect(window.api.pty.kill).toHaveBeenCalledWith('pty-setup')
  })
})

describe('routeCreateSetup', () => {
  it('hides a create-chat setup and leaves no visible setup for the caller to seed', async () => {
    const visible = routeCreateSetup({ presentation: 'chat-background-task', worktree, setup })

    expect(visible).toBeUndefined()
    await vi.waitFor(() => expect(window.api.worktreeSetupRuns.register).toHaveBeenCalledOnce())
    expect(terminalTabs()).toHaveLength(0)
  })

  it('keeps the setup visible for any other create', () => {
    expect(routeCreateSetup({ presentation: undefined, worktree, setup })).toBe(setup)
    expect(window.api.pty.spawn).not.toHaveBeenCalled()
  })
})

describe('revealWorktreeSetupRun', () => {
  it('promotes the PTY into one terminal tab and activates the workspace and tab', () => {
    const revealed = revealWorktreeSetupRun({ worktreeId: worktree.id, ptyId: 'pty-setup' })

    expect(revealed).toBe(true)
    expect(mocks.activateAndRevealWorkspace).toHaveBeenCalledWith(worktree.id, {
      providesInitialSurface: true
    })
    expect(terminalTabs()).toHaveLength(1)
    expect(terminalTabs()[0]).toMatchObject({ ptyId: 'pty-setup', customTitle: 'Setup' })
    expect(useAppStore.getState().activeTabIdByWorktree[worktree.id]).toBe(terminalTabs()[0].id)
  })

  it('selects the tab it already made instead of adding another', () => {
    revealWorktreeSetupRun({ worktreeId: worktree.id, ptyId: 'pty-setup' })
    const firstTabId = terminalTabs()[0].id

    revealWorktreeSetupRun({ worktreeId: worktree.id, ptyId: 'pty-setup' })

    expect(terminalTabs()).toHaveLength(1)
    expect(useAppStore.getState().activeTabIdByWorktree[worktree.id]).toBe(firstTabId)
  })
})
