import { describe, expect, it, vi } from 'vitest'
import type {
  AgentProviderSessionMetadata,
  SleepingAgentSessionRecord
} from '../../../../shared/agent-session-resume'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import {
  showStructuredChatInTerminal,
  structuredChatTerminalViewState,
  type ShowStructuredChatInTerminalArgs,
  type ShowStructuredChatInTerminalDeps,
  type StructuredChatTerminalLaunch
} from './structured-chat-terminal-view'

const LOCAL: RuntimeClientTarget = { kind: 'local' }
const SESSION = { key: 'session_id', id: 'provider-1' } as const
type LaunchOptions = { onSessionLaunched: (tabId: string) => void }

function args(
  overrides: Partial<ShowStructuredChatInTerminalArgs> = {}
): ShowStructuredChatInTerminalArgs {
  return {
    target: LOCAL,
    tabId: 'agent-session-tab-1',
    worktreeId: 'repo::/work/feature',
    paneKey: 'agent-session-tab-1:session-1',
    sessionId: 'session-1',
    launch: { mode: 'resume', agent: 'claude', providerSession: SESSION },
    ...overrides
  }
}

/** Deps whose launch opens the terminal as `launchedTabId` (or reports no tab when null). */
function deps(
  overrides: Partial<ShowStructuredChatInTerminalDeps> = {},
  launchedTabId: string | null = 'terminal-tab-9'
): ShowStructuredChatInTerminalDeps {
  const opened = (options: LaunchOptions): boolean => {
    if (launchedTabId !== null) {
      options.onSessionLaunched(launchedTabId)
    }
    return true
  }
  return {
    releaseProviderChild: vi.fn(async () => 'closed' as const),
    launchResume: vi.fn((_record: SleepingAgentSessionRecord, options: LaunchOptions) =>
      opened(options)
    ),
    launchFresh: vi.fn((_request: unknown, options: LaunchOptions) => opened(options)),
    resolvePiRuntime: vi.fn(async ({ sessionRuntime }) => sessionRuntime ?? 'pi'),
    recordTerminalLink: vi.fn(),
    closeChatTab: vi.fn(),
    onReleaseFailed: vi.fn(),
    onLaunchFailedAfterRelease: vi.fn(),
    now: () => 1000,
    ...overrides
  }
}

/** The provider session shape each resumable agent reports. */
const SESSIONS: Record<'claude' | 'codex' | 'pi' | 'antigravity', AgentProviderSessionMetadata> = {
  claude: SESSION,
  codex: SESSION,
  pi: { key: 'session_id', id: 'provider-1', transcriptPath: '/home/u/.pi/agent/s.jsonl' },
  antigravity: { key: 'conversation_id', id: 'provider-1' }
}

describe('structuredChatTerminalViewState', () => {
  it.each(['claude', 'codex', 'pi', 'antigravity'] as const)(
    'resumes the %s provider session when the chat has one',
    (agent) => {
      expect(
        structuredChatTerminalViewState({
          worktreeId: 'wt',
          agent,
          providerSession: SESSIONS[agent]
        })
      ).toEqual({
        enabled: true,
        launch: { mode: 'resume', agent, providerSession: SESSIONS[agent] }
      })
    }
  )

  it('blocks a chat whose provider session cannot be resumed, rather than starting fresh', () => {
    expect(
      structuredChatTerminalViewState({
        worktreeId: 'wt',
        agent: 'pi',
        providerSession: { key: 'session_id', id: 'provider-1' }
      })
    ).toEqual({ enabled: false, reason: 'no-provider-session' })
  })

  it('blocks a non-resumable TUI agent that already has a provider session, rather than starting fresh', () => {
    expect(
      structuredChatTerminalViewState({
        worktreeId: 'wt',
        agent: 'aider',
        providerSession: SESSION
      })
    ).toEqual({ enabled: false, reason: 'agent' })
  })

  it.each(['claude', 'codex', 'pi', 'antigravity'] as const)(
    'offers a fresh %s terminal before the chat has a provider session',
    (agent) => {
      expect(
        structuredChatTerminalViewState({ worktreeId: 'wt', agent, providerSession: undefined })
      ).toEqual({ enabled: true, launch: { mode: 'fresh', agent } })
    }
  )

  it('offers a fresh terminal for a known TUI agent that cannot resume a session', () => {
    expect(
      structuredChatTerminalViewState({
        worktreeId: 'wt',
        agent: 'gemini',
        providerSession: undefined
      })
    ).toEqual({ enabled: true, launch: { mode: 'fresh', agent: 'gemini' } })
  })

  it('blocks a chat whose workspace is not known yet', () => {
    expect(
      structuredChatTerminalViewState({
        worktreeId: '',
        agent: 'codex',
        providerSession: undefined
      })
    ).toEqual({ enabled: false, reason: 'no-worktree' })
  })

  it('blocks a chat whose agent is not a TUI agent', () => {
    expect(
      structuredChatTerminalViewState({
        worktreeId: 'wt',
        agent: 'not-an-agent',
        providerSession: SESSION
      })
    ).toEqual({ enabled: false, reason: 'agent' })
  })
})

describe('showStructuredChatInTerminal', () => {
  it.each(['claude', 'codex', 'pi', 'antigravity'] as const)(
    'links the %s terminal to its provider session and structured chat, then closes the chat',
    async (agent) => {
      const d = deps()

      await expect(
        showStructuredChatInTerminal(
          args({ launch: { mode: 'resume', agent, providerSession: SESSION } }),
          d
        )
      ).resolves.toBe(true)

      expect(d.recordTerminalLink).toHaveBeenCalledWith('terminal-tab-9', {
        agent,
        providerSessionId: 'provider-1',
        worktreeId: 'repo::/work/feature',
        structuredSessionId: 'session-1'
      })
      expect(d.closeChatTab).toHaveBeenCalledWith('agent-session-tab-1')
    }
  )

  it.each(['claude', 'codex', 'pi', 'antigravity', 'gemini'] as const)(
    'starts a fresh %s terminal in the chat worktree and closes the empty chat',
    async (agent) => {
      const d = deps()
      const launch: StructuredChatTerminalLaunch = { mode: 'fresh', agent }

      await expect(showStructuredChatInTerminal(args({ launch }), d)).resolves.toBe(true)

      expect(d.releaseProviderChild).toHaveBeenCalledWith(LOCAL, 'session-1')
      expect(d.launchResume).not.toHaveBeenCalled()
      expect(d.launchFresh).toHaveBeenCalledWith(
        agent === 'pi'
          ? { worktreeId: 'repo::/work/feature', agent, piRuntime: 'pi' }
          : { worktreeId: 'repo::/work/feature', agent },
        { onSessionLaunched: expect.any(Function) }
      )
      // Why: a fresh terminal of a structured agent still returns to its chat, by session id alone.
      if (agent === 'gemini') {
        expect(d.recordTerminalLink).not.toHaveBeenCalled()
      } else {
        expect(d.recordTerminalLink).toHaveBeenCalledWith('terminal-tab-9', {
          agent,
          worktreeId: 'repo::/work/feature',
          structuredSessionId: 'session-1'
        })
      }
      expect(d.closeChatTab).toHaveBeenCalledWith('agent-session-tab-1')
    }
  )

  it('resolves the Pi runtime before it releases the chat, and starts that runtime when the chat has no evidence', async () => {
    const order: string[] = []
    const d = deps({
      releaseProviderChild: vi.fn(async () => {
        order.push('release')
        return 'closed' as const
      }),
      resolvePiRuntime: vi.fn(async () => {
        order.push('resolve')
        return 'gentle-shell' as const
      })
    })

    await showStructuredChatInTerminal(args({ launch: { mode: 'fresh', agent: 'pi' } }), d)

    expect(d.resolvePiRuntime).toHaveBeenCalledWith({ worktreeId: 'repo::/work/feature' })
    expect(order).toEqual(['resolve', 'release'])
    expect(d.launchFresh).toHaveBeenCalledWith(
      { worktreeId: 'repo::/work/feature', agent: 'pi', piRuntime: 'gentle-shell' },
      { onSessionLaunched: expect.any(Function) }
    )
  })

  it('hands the runtime the session named to the resolver and keeps it for the resume', async () => {
    const d = deps()

    await showStructuredChatInTerminal(
      args({
        launch: { mode: 'resume', agent: 'pi', providerSession: SESSIONS.pi },
        piRuntime: 'gentle-shell'
      }),
      d
    )

    expect(d.resolvePiRuntime).toHaveBeenCalledWith({
      worktreeId: 'repo::/work/feature',
      sessionRuntime: 'gentle-shell'
    })
    expect(d.launchResume).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'pi', piRuntime: 'gentle-shell' }),
      { onSessionLaunched: expect.any(Function) }
    )
  })

  it('passes the Gentle Shell runtime to a fresh Pi terminal', async () => {
    const d = deps()

    await showStructuredChatInTerminal(
      args({ launch: { mode: 'fresh', agent: 'pi' }, piRuntime: 'gentle-shell' }),
      d
    )

    expect(d.launchFresh).toHaveBeenCalledWith(
      { worktreeId: 'repo::/work/feature', agent: 'pi', piRuntime: 'gentle-shell' },
      { onSessionLaunched: expect.any(Function) }
    )
  })

  it('records no link when the launch reports no terminal tab', async () => {
    const d = deps({}, null)

    await expect(showStructuredChatInTerminal(args(), d)).resolves.toBe(true)

    expect(d.recordTerminalLink).not.toHaveBeenCalled()
  })

  it('records no link for an agent with no structured adapter on this build', async () => {
    const d = deps()

    await expect(
      showStructuredChatInTerminal(
        args({ launch: { mode: 'resume', agent: 'gemini', providerSession: SESSION } }),
        d
      )
    ).resolves.toBe(true)

    expect(d.recordTerminalLink).not.toHaveBeenCalled()
    expect(d.closeChatTab).toHaveBeenCalledWith('agent-session-tab-1')
  })

  it('records no link and keeps the chat open when the terminal did not start', async () => {
    const d = deps({ launchResume: vi.fn(() => false) })

    await expect(showStructuredChatInTerminal(args(), d)).resolves.toBe(false)

    expect(d.recordTerminalLink).not.toHaveBeenCalled()
    expect(d.closeChatTab).not.toHaveBeenCalled()
    expect(d.onLaunchFailedAfterRelease).toHaveBeenCalledTimes(1)
  })

  it('keeps a fresh chat open when its terminal did not start', async () => {
    const d = deps({ launchFresh: vi.fn(() => false) })

    await expect(
      showStructuredChatInTerminal(args({ launch: { mode: 'fresh', agent: 'codex' } }), d)
    ).resolves.toBe(false)

    expect(d.closeChatTab).not.toHaveBeenCalled()
    expect(d.onLaunchFailedAfterRelease).toHaveBeenCalledTimes(1)
  })

  it('launches nothing and records nothing when the provider child cannot be released', async () => {
    const d = deps({ releaseProviderChild: vi.fn(async () => 'unsupported' as const) })

    await expect(showStructuredChatInTerminal(args(), d)).resolves.toBe(false)

    expect(d.launchResume).not.toHaveBeenCalled()
    expect(d.launchFresh).not.toHaveBeenCalled()
    expect(d.recordTerminalLink).not.toHaveBeenCalled()
    expect(d.onReleaseFailed).toHaveBeenCalledTimes(1)
  })

  it('launches nothing when a fresh chat cannot release its provider child', async () => {
    const d = deps({
      releaseProviderChild: vi.fn(async () => {
        throw new Error('gone')
      })
    })

    await expect(
      showStructuredChatInTerminal(args({ launch: { mode: 'fresh', agent: 'claude' } }), d)
    ).resolves.toBe(false)

    expect(d.launchFresh).not.toHaveBeenCalled()
    expect(d.onReleaseFailed).toHaveBeenCalledTimes(1)
  })
})
