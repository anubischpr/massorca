import { describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import {
  createStructuredChatPaneActions,
  type StructuredChatPaneActionsDeps,
  type StructuredChatPaneActionsInput
} from './structured-chat-pane-actions'
import { structuredChatPiRuntime } from './structured-agent-declared-access'

const LOCAL: RuntimeClientTarget = { kind: 'local' }

function input(
  overrides: Partial<StructuredChatPaneActionsInput> = {}
): StructuredChatPaneActionsInput {
  return {
    tabId: 'agent-session-tab-1',
    groupId: 'group-1',
    worktreeId: 'repo::/work/feature',
    sessionId: 'session-1',
    paneKey: 'agent-session-tab-1:session-1',
    target: LOCAL,
    agent: 'claude',
    providerSession: { key: 'session_id', id: 'provider-1' },
    workspacePath: '/work/feature',
    capturedText: 'user: hello',
    ...overrides
  }
}

function deps(
  overrides: Partial<StructuredChatPaneActionsDeps> = {},
  calls: string[] = []
): StructuredChatPaneActionsDeps {
  return {
    splitRight: vi.fn(() => true),
    closeTab: vi.fn(() => {
      calls.push('closeTab')
    }),
    releaseProviderChild: vi.fn(async () => {
      calls.push('release')
      return 'closed' as const
    }),
    launchResume: vi.fn((_record: SleepingAgentSessionRecord) => {
      calls.push('launch')
      return true
    }),
    launchFresh: vi.fn(() => {
      calls.push('launchFresh')
      return true
    }),
    resolvePiRuntime: vi.fn(async ({ sessionRuntime }) => {
      calls.push('resolvePiRuntime')
      return sessionRuntime ?? 'pi'
    }),
    recordTerminalLink: vi.fn(),
    prepareContinuation: vi.fn(() => null),
    onTerminalViewReleaseFailed: vi.fn(),
    onTerminalViewLaunchFailed: vi.fn(),
    ...overrides
  }
}

describe('createStructuredChatPaneActions', () => {
  it('splits the chat tab to the right within its group', () => {
    const d = deps()
    createStructuredChatPaneActions(input(), d).splitRight()
    expect(d.splitRight).toHaveBeenCalledWith('agent-session-tab-1', 'group-1')
  })

  it('does not split a chat that has no group', () => {
    const d = deps()
    createStructuredChatPaneActions(input({ groupId: null }), d).splitRight()
    expect(d.splitRight).not.toHaveBeenCalled()
  })

  it('closes through the tab close path for the chat tab', () => {
    const d = deps()
    createStructuredChatPaneActions(input(), d).close()
    expect(d.closeTab).toHaveBeenCalledWith('agent-session-tab-1')
  })

  it('leaves the provider child running when a session cannot be resumed in the terminal', async () => {
    const d = deps()
    const actions = createStructuredChatPaneActions(
      input({ agent: 'pi', providerSession: { key: 'session_id', id: 'provider-1' } }),
      d
    )
    expect(actions.terminalView).toEqual({ enabled: false, reason: 'no-provider-session' })
    await expect(actions.showTerminal()).resolves.toBe(false)
    expect(d.releaseProviderChild).not.toHaveBeenCalled()
    expect(d.launchResume).not.toHaveBeenCalled()
    expect(d.launchFresh).not.toHaveBeenCalled()
    expect(d.closeTab).not.toHaveBeenCalled()
  })

  it('starts a fresh terminal of the agent for a chat with no provider session yet', async () => {
    const calls: string[] = []
    const d = deps({}, calls)
    const actions = createStructuredChatPaneActions(input({ providerSession: undefined }), d)
    expect(actions.terminalView).toEqual({
      enabled: true,
      launch: { mode: 'fresh', agent: 'claude' }
    })
    await expect(actions.showTerminal()).resolves.toBe(true)
    expect(calls).toEqual(['release', 'launchFresh', 'closeTab'])
    expect(d.launchFresh).toHaveBeenCalledWith(
      { worktreeId: 'repo::/work/feature', agent: 'claude' },
      expect.objectContaining({ onSessionLaunched: expect.any(Function) })
    )
    expect(d.launchResume).not.toHaveBeenCalled()
    expect(d.recordTerminalLink).not.toHaveBeenCalled()
  })

  it('starts a fresh Gentle Shell terminal for a Gentle Shell chat with no session yet', async () => {
    const d = deps()
    const actions = createStructuredChatPaneActions(
      input({ agent: 'pi', piRuntime: 'gentle-shell', providerSession: undefined }),
      d
    )
    await expect(actions.showTerminal()).resolves.toBe(true)
    expect(d.launchFresh).toHaveBeenCalledWith(
      { worktreeId: 'repo::/work/feature', agent: 'pi', piRuntime: 'gentle-shell' },
      expect.anything()
    )
  })

  it('resumes a Gentle Shell chat in the terminal with its runtime', async () => {
    const d = deps()
    const actions = createStructuredChatPaneActions(
      input({
        agent: 'pi',
        piRuntime: 'gentle-shell',
        providerSession: { key: 'session_id', id: 'provider-1', transcriptPath: '/t/s.jsonl' }
      }),
      d
    )
    await expect(actions.showTerminal()).resolves.toBe(true)
    expect(d.launchResume).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'pi', piRuntime: 'gentle-shell' }),
      expect.anything()
    )
  })

  it('lets the host decide the runtime of a Pi chat whose session names none, before releasing it', async () => {
    const calls: string[] = []
    const d = deps(
      {
        resolvePiRuntime: vi.fn(async () => {
          calls.push('resolvePiRuntime')
          return 'gentle-shell' as const
        })
      },
      calls
    )
    const actions = createStructuredChatPaneActions(
      input({ agent: 'pi', providerSession: undefined }),
      d
    )
    await expect(actions.showTerminal()).resolves.toBe(true)
    expect(d.resolvePiRuntime).toHaveBeenCalledWith({ worktreeId: 'repo::/work/feature' })
    expect(calls).toEqual(['resolvePiRuntime', 'release', 'launchFresh', 'closeTab'])
    expect(d.launchFresh).toHaveBeenCalledWith(
      { worktreeId: 'repo::/work/feature', agent: 'pi', piRuntime: 'gentle-shell' },
      expect.anything()
    )
  })

  it('resumes a Pi chat whose session names no runtime with the one the host decides', async () => {
    const d = deps({ resolvePiRuntime: vi.fn(async () => 'gentle-shell' as const) })
    const actions = createStructuredChatPaneActions(
      input({
        agent: 'pi',
        providerSession: { key: 'session_id', id: 'provider-1', transcriptPath: '/t/s.jsonl' }
      }),
      d
    )
    await expect(actions.showTerminal()).resolves.toBe(true)
    expect(d.launchResume).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'pi', piRuntime: 'gentle-shell' }),
      expect.anything()
    )
  })

  it('never asks the host about the runtime of another agent', async () => {
    const d = deps()
    await createStructuredChatPaneActions(input(), d).showTerminal()
    expect(d.resolvePiRuntime).not.toHaveBeenCalled()
    expect(vi.mocked(d.launchResume).mock.calls[0]?.[0]).not.toHaveProperty('piRuntime')
  })

  it('releases the provider child before launching the terminal resume, then closes the chat tab', async () => {
    const calls: string[] = []
    const d = deps({}, calls)
    const launched = createStructuredChatPaneActions(input(), d)
    await expect(launched.showTerminal()).resolves.toBe(true)
    expect(calls).toEqual(['release', 'launch', 'closeTab'])
    expect(d.launchResume).toHaveBeenCalledWith(
      expect.objectContaining({
        worktreeId: 'repo::/work/feature',
        agent: 'claude',
        providerSession: { key: 'session_id', id: 'provider-1' },
        paneKey: 'agent-session-tab-1:session-1'
      }),
      expect.objectContaining({ onSessionLaunched: expect.any(Function) })
    )
  })

  it('keeps the chat open and reports the failure when the release is unsupported', async () => {
    const calls: string[] = []
    const d = deps(
      {
        releaseProviderChild: vi.fn(async () => {
          calls.push('release')
          return 'unsupported' as const
        })
      },
      calls
    )
    await expect(createStructuredChatPaneActions(input(), d).showTerminal()).resolves.toBe(false)
    expect(calls).toEqual(['release'])
    expect(d.onTerminalViewReleaseFailed).toHaveBeenCalledTimes(1)
    expect(d.onTerminalViewLaunchFailed).not.toHaveBeenCalled()
  })

  it('keeps the chat open when the release throws, before anything launches', async () => {
    const calls: string[] = []
    const failure = new Error('host unreachable')
    const d = deps(
      {
        releaseProviderChild: vi.fn(async () => {
          calls.push('release')
          throw failure
        })
      },
      calls
    )
    await expect(createStructuredChatPaneActions(input(), d).showTerminal()).resolves.toBe(false)
    expect(d.onTerminalViewReleaseFailed).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['release'])
    expect(d.closeTab).not.toHaveBeenCalled()
  })

  it('keeps the chat tab open and says the child was released when the terminal cannot launch', async () => {
    const d = deps({ launchResume: vi.fn(() => false) })
    await expect(createStructuredChatPaneActions(input(), d).showTerminal()).resolves.toBe(false)
    expect(d.closeTab).not.toHaveBeenCalled()
    expect(d.onTerminalViewLaunchFailed).toHaveBeenCalledTimes(1)
    expect(d.onTerminalViewReleaseFailed).not.toHaveBeenCalled()
  })

  it('shows and releases a paired-server chat on its environment, before launching on that host', async () => {
    const calls: string[] = []
    const env = { kind: 'environment' as const, environmentId: 'env-1' }
    const d = deps(
      {
        releaseProviderChild: vi.fn(async (target: RuntimeClientTarget) => {
          calls.push(`release:${target.kind}`)
          return 'closed' as const
        })
      },
      calls
    )
    const actions = createStructuredChatPaneActions(input({ target: env }), d)
    expect(actions.terminalView.enabled).toBe(true)
    await expect(actions.showTerminal()).resolves.toBe(true)
    expect(calls).toEqual(['release:environment', 'launch', 'closeTab'])
    expect(d.releaseProviderChild).toHaveBeenCalledWith(env, 'session-1')
  })

  it('hands off a chat with its transcript path and conversation text', () => {
    const d = deps({
      prepareContinuation: vi.fn(() => null)
    })
    createStructuredChatPaneActions(
      input({ providerSession: { key: 'session_id', id: 'p', transcriptPath: '/t/p.jsonl' } }),
      d
    ).handOff()
    expect(d.prepareContinuation).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          sourceAgent: 'claude',
          capturedText: 'user: hello',
          transcriptPath: '/t/p.jsonl',
          sourceWorkingDirectory: '/work/feature'
        }),
        worktreeId: 'repo::/work/feature',
        groupId: 'group-1'
      })
    )
  })

  it('does not hand off an agent that is not a terminal agent', () => {
    const d = deps()
    expect(
      createStructuredChatPaneActions(input({ agent: 'not-an-agent' }), d).handOff()
    ).toBeNull()
    expect(d.prepareContinuation).not.toHaveBeenCalled()
  })
})

describe('structuredChatPiRuntime', () => {
  it('reads the launch seed', () => {
    expect(
      structuredChatPiRuntime({ agent: 'pi', launchSeedOptions: { piRuntime: 'gentle-shell' } })
    ).toBe('gentle-shell')
  })

  it('has no verdict for a session with no evidence or an invalid seed', () => {
    expect(structuredChatPiRuntime({ agent: 'pi', launchSeedOptions: undefined })).toBeUndefined()
    expect(
      structuredChatPiRuntime({ agent: 'pi', launchSeedOptions: { piRuntime: 'not-a-runtime' } })
    ).toBeUndefined()
  })

  it('reads Gentle Shell from the session transcript when no seed names it', () => {
    expect(
      structuredChatPiRuntime({
        agent: 'pi',
        launchSeedOptions: undefined,
        transcriptPath: '/home/christian/.gentle-shell/agent/sessions/--w--/2026_s.jsonl'
      })
    ).toBe('gentle-shell')
    expect(
      structuredChatPiRuntime({
        agent: 'pi',
        launchSeedOptions: undefined,
        transcriptPath: String.raw`C:\Users\me\.gentle-shell\agent\sessions\s.jsonl`
      })
    ).toBe('gentle-shell')
  })

  it('reads a stock Pi transcript as stock Pi', () => {
    expect(
      structuredChatPiRuntime({
        agent: 'pi',
        launchSeedOptions: undefined,
        transcriptPath: '/home/christian/.pi/agent/sessions/--w--/s.jsonl'
      })
    ).toBe('pi')
  })

  it('prefers the host-recorded runtime over the seed and the transcript', () => {
    expect(
      structuredChatPiRuntime({
        agent: 'pi',
        launchSeedOptions: { piRuntime: 'pi' },
        transcriptPath: '/custom/agent/sessions/s.jsonl',
        hostRuntime: 'gentle-shell'
      })
    ).toBe('gentle-shell')
  })

  it('is undefined for agents other than Pi', () => {
    expect(
      structuredChatPiRuntime({
        agent: 'claude',
        launchSeedOptions: { piRuntime: 'gentle-shell' },
        hostRuntime: 'gentle-shell'
      })
    ).toBeUndefined()
  })
})
