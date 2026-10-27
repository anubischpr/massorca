import { describe, expect, it, vi } from 'vitest'
import {
  provisionWorktreeTerminals,
  type WorktreeTerminalProvisioningArgs,
  type WorktreeTerminalProvisioningHost
} from './runtime-worktree-terminal-provisioning'

const DEFAULT_TABS = {
  runCommands: true,
  tabs: [
    { title: 'Dev', command: 'pnpm dev', color: '#ff0000' },
    { title: 'Tests', command: 'pnpm test', color: '#00ff00' }
  ]
}

function fakeHost(settings: Record<string, unknown> = {}) {
  let created = 0
  return {
    canSpawn: () => true,
    createTerminal: vi.fn(async () => {
      created += 1
      return { handle: `term_${created}` }
    }),
    splitTerminal: vi.fn(async () => ({ handle: 'split_1' })),
    setTabTitle: vi.fn(async (_handle: string, _title: string) => {}),
    setTabColor: vi.fn(async (_handle: string, _color: string) => {}),
    getSettings: () => settings,
    getPtyId: () => undefined,
    recordSetupCompletionToken: vi.fn()
  } satisfies Partial<Record<keyof WorktreeTerminalProvisioningHost, unknown>>
}

function provision(host: ReturnType<typeof fakeHost>, startup: boolean) {
  return provisionWorktreeTerminals(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every host member provisioning reaches for default tabs with no setup.
    host as unknown as WorktreeTerminalProvisioningHost,
    {
      worktreeSelector: 'id:wt-1',
      worktreeId: 'wt-1',
      worktreePath: '/worktrees/wt-1',
      defaultTabs: DEFAULT_TABS,
      primaryTerminalHandle: startup ? 'term_agent' : null,
      hasStartupTerminal: startup,
      setupCommandPlatform: 'posix'
    }
  )
}

describe('default tabs beside the agent a create started', () => {
  it('makes the agent the first default tab, as the window lays it out', async () => {
    const host = fakeHost()
    await provision(host, true)

    expect(host.setTabTitle).toHaveBeenCalledWith('term_agent', 'Dev')
    expect(host.setTabColor).toHaveBeenCalledWith('term_agent', '#ff0000')
    // The first template's command never runs beside the agent; only the rest are created.
    expect(host.createTerminal).toHaveBeenCalledTimes(1)
    expect(host.createTerminal).toHaveBeenCalledWith('id:wt-1', {
      title: 'Tests',
      command: 'pnpm test'
    })
  })

  it('dresses every created default tab the same way', async () => {
    const host = fakeHost()
    await provision(host, false)

    expect(host.createTerminal).toHaveBeenCalledTimes(2)
    expect(host.setTabTitle.mock.calls).toEqual([
      ['term_1', 'Dev'],
      ['term_2', 'Tests']
    ])
    expect(host.setTabColor.mock.calls).toEqual([
      ['term_1', '#ff0000'],
      ['term_2', '#00ff00']
    ])
  })

  it('still colors the tab and creates the rest when titling fails', async () => {
    const host = fakeHost()
    host.setTabTitle.mockRejectedValue(new Error('terminal_tab_unresolved'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(provision(host, true)).resolves.toEqual({
      setupSpawned: false,
      setupTerminalHandle: null
    })

    expect(host.setTabColor).toHaveBeenCalledWith('term_agent', '#ff0000')
    expect(host.createTerminal).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[worktree-create] Failed to title a default tab for wt-1:',
      expect.any(Error)
    )
    warn.mockRestore()
  })
})

const SETUP = { runnerScriptPath: '/worktrees/wt-1/setup.sh', envVars: {} }

function provisionSetup(
  host: ReturnType<typeof fakeHost>,
  overrides: Partial<WorktreeTerminalProvisioningArgs> = {}
) {
  return provisionWorktreeTerminals(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every host member a setup spawn reaches for.
    host as unknown as WorktreeTerminalProvisioningHost,
    {
      worktreeSelector: 'id:wt-1',
      worktreeId: 'wt-1',
      worktreePath: '/worktrees/wt-1',
      setup: SETUP,
      primaryTerminalHandle: null,
      hasStartupTerminal: false,
      setupCommandPlatform: 'posix',
      ...overrides
    }
  )
}

describe('the bare shell beside a setup with no startup agent', () => {
  it('spawns no bare shell when a new-tab setup runs alone', async () => {
    const host = fakeHost()
    await expect(provisionSetup(host)).resolves.toEqual({
      setupSpawned: true,
      setupTerminalHandle: 'term_1'
    })
    expect(host.createTerminal).toHaveBeenCalledTimes(1)
    expect(host.createTerminal).toHaveBeenCalledWith('id:wt-1', {
      title: 'Setup',
      command: expect.any(String),
      env: {}
    })
  })

  it('keeps the bare shell as the split target when setup splits', async () => {
    const host = fakeHost({ setupScriptLaunchMode: 'split-vertical' })
    await provisionSetup(host)
    expect(host.createTerminal).toHaveBeenCalledTimes(1)
    expect(host.createTerminal).toHaveBeenCalledWith('id:wt-1', {})
    expect(host.splitTerminal).toHaveBeenCalledWith(
      'term_1',
      expect.objectContaining({ direction: 'vertical', activate: false })
    )
  })

  it('keeps the bare shell when no setup runs', async () => {
    const host = fakeHost()
    await provisionSetup(host, { setup: undefined })
    expect(host.createTerminal).toHaveBeenCalledTimes(1)
    expect(host.createTerminal).toHaveBeenCalledWith('id:wt-1', {})
  })
})

describe('a hidden setup beside a chat-first create', () => {
  it('runs setup in the background, beside no default tabs, bare shell, or split', async () => {
    const host = fakeHost({ setupScriptLaunchMode: 'split-vertical' })
    await expect(
      provisionSetup(host, {
        defaultTabs: DEFAULT_TABS,
        setupPresentation: 'chat-background-task'
      })
    ).resolves.toEqual({ setupSpawned: true, setupTerminalHandle: 'term_1' })
    expect(host.createTerminal).toHaveBeenCalledTimes(1)
    expect(host.createTerminal).toHaveBeenCalledWith(
      'id:wt-1',
      expect.objectContaining({ title: 'Setup', noSessionTab: true })
    )
    expect(host.splitTerminal).not.toHaveBeenCalled()
    expect(host.setTabTitle).not.toHaveBeenCalled()
  })

  it('creates nothing when there is no setup to hide', async () => {
    const host = fakeHost()
    await expect(
      provisionSetup(host, {
        setup: undefined,
        defaultTabs: DEFAULT_TABS,
        setupPresentation: 'chat-background-task'
      })
    ).resolves.toEqual({ setupSpawned: false, setupTerminalHandle: null })
    expect(host.createTerminal).not.toHaveBeenCalled()
  })
})
