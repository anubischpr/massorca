import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeProviderSessionInNewChatArgs } from '@/lib/provider-session-structured-chat-resume'
import { StructuredAgentSessionCreateRefusalError } from '@/lib/structured-agent-session-launch-errors'
import type { StructuredChatTerminalLink } from '../../store/terminals/terminal-contracts'
import {
  returnTerminalToStructuredChat,
  revealStructuredChatTab,
  terminalChatToggleRoute,
  type StructuredChatTerminalReturnDeps
} from './structured-chat-terminal-return'

const mocks = vi.hoisted(() => ({ toastError: vi.fn<(message: string) => void>() }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
// Why: the default dependencies are never used here (each test passes its own), so the store graph stays unloaded.
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
const chatHost = vi.hoisted(() => ({
  activate: vi.fn((_args: { worktreeId: string; sessionId: string }) => true),
  listed: vi.fn((_args: { worktreeId: string; sessionId: string }) => false),
  reveal: vi.fn(
    async (_args: {
      worktreeId: string
      sessionId: string
    }): Promise<'revealed' | 'gone' | 'host-cannot-open' | 'unreachable'> => 'revealed'
  ),
  refresh: vi.fn(async (_worktreeId: string) => undefined)
}))
vi.mock('@/lib/structured-agent-session-tab-activation', () => ({
  activateStructuredAgentSessionById: chatHost.activate,
  structuredAgentSessionTabListed: chatHost.listed
}))
vi.mock('@/lib/activate-ai-vault-structured-session', () => ({
  revealStructuredSession: chatHost.reveal,
  refreshStructuredSessionTabs: chatHost.refresh
}))
vi.mock('../../store/terminals/terminal-tab-confirmed-close', () => ({
  closeTerminalTabConfirmingExit: vi.fn()
}))
vi.mock('@/lib/provider-session-structured-chat-resume', () => ({
  resumeProviderSessionInNewStructuredChat: vi.fn()
}))

const UNCONFIRMED =
  'Could not confirm the terminal stopped, so this chat was not reopened. The terminal may still be running.'
const HELD_BY_TERMINAL =
  'This conversation is still running in a terminal, so the chat was not reopened.'
const FAILED = 'Could not reopen this chat. Its terminal was closed and the conversation is kept.'
const NOT_SHOWN =
  'The terminal was closed, but this chat could not be shown. Its conversation is kept.'
const GONE =
  'This chat is no longer on this host, so it cannot be reopened here. The terminal was kept.'
const HOST_CANNOT_OPEN =
  "This chat can't be reopened until MassOrca is updated. The terminal was kept."
const UNREACHABLE =
  'Could not reach the host to reopen this chat. The terminal was kept; try again in a moment.'

const WORKTREE = 'repo::/work/feature'

/** One terminal return per agent. Gentle Shell chats are Pi-protocol chats on the gentle-shell runtime. */
const LINKS: Record<string, StructuredChatTerminalLink> = {
  claude: {
    agent: 'claude',
    providerSessionId: 'claude-session-1',
    worktreeId: WORKTREE,
    structuredSessionId: 'claude-chat-1'
  },
  codex: {
    agent: 'codex',
    providerSessionId: 'thread-7',
    worktreeId: WORKTREE,
    structuredSessionId: 'codex-chat-1'
  },
  'gentle-shell': {
    agent: 'pi',
    providerSessionId: 'pi-session-9',
    worktreeId: WORKTREE,
    structuredSessionId: 'gentle-shell-chat-1'
  },
  antigravity: {
    agent: 'antigravity',
    providerSessionId: 'conversation-3',
    worktreeId: WORKTREE,
    structuredSessionId: 'antigravity-chat-1'
  }
}

/** Agents whose chat is reached by session id only; a chat the host cannot list is never adopted. */
const SESSION_ID_ONLY = ['gentle-shell', 'antigravity'] as const
/** Agents whose chat can also be adopted as a new chat from the provider session. */
const ADOPTABLE = ['claude', 'codex'] as const

/** Deps that record every step, so each test can assert the order. */
function deps(
  overrides: Partial<StructuredChatTerminalReturnDeps> = {},
  steps: string[] = []
): StructuredChatTerminalReturnDeps {
  return {
    closeTerminalTabConfirmingExit: vi.fn(async () => {
      steps.push('closed')
      return true
    }),
    revealStructuredChat: vi.fn(async () => {
      steps.push('revealed')
      return 'ready' as const
    }),
    activateStructuredChat: vi.fn(() => {
      steps.push('activated')
      return true
    }),
    resumeInStructuredChat: vi.fn((_args: ResumeProviderSessionInNewChatArgs) => {
      steps.push('resumed')
      return { sessionId: 'session-1' }
    }),
    newRequestId: vi.fn(() => 'request-1'),
    ...overrides
  }
}

describe('returnTerminalToStructuredChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(Object.keys(LINKS))(
    'reveals the %s chat, stops the terminal, then shows the chat',
    async (name) => {
      const steps: string[] = []
      const d = deps({}, steps)

      await expect(
        returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS[name] }, d)
      ).resolves.toBe(true)

      expect(steps).toEqual(['revealed', 'closed', 'activated'])
      expect(d.revealStructuredChat).toHaveBeenCalledWith({
        worktreeId: WORKTREE,
        sessionId: LINKS[name].structuredSessionId
      })
      expect(d.activateStructuredChat).toHaveBeenCalledWith({
        worktreeId: WORKTREE,
        sessionId: LINKS[name].structuredSessionId
      })
      expect(d.resumeInStructuredChat).not.toHaveBeenCalled()
      expect(mocks.toastError).not.toHaveBeenCalled()
    }
  )

  it.each(SESSION_ID_ONLY)(
    'keeps the %s terminal running and says so when the chat cannot be revealed',
    async (name) => {
      const d = deps({
        revealStructuredChat: vi.fn(async () => 'gone' as const)
      })

      await expect(
        returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS[name] }, d)
      ).resolves.toBe(false)

      expect(d.closeTerminalTabConfirmingExit).not.toHaveBeenCalled()
      expect(d.activateStructuredChat).not.toHaveBeenCalled()
      expect(d.resumeInStructuredChat).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(GONE)
    }
  )

  it.each([
    ['host-cannot-open', HOST_CANNOT_OPEN],
    ['unreachable', UNREACHABLE]
  ] as const)(
    'names a reveal that answered %s before the terminal is touched',
    async (outcome, message) => {
      const d = deps({ revealStructuredChat: vi.fn(async () => outcome) })

      await expect(
        returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS['gentle-shell'] }, d)
      ).resolves.toBe(false)

      expect(d.closeTerminalTabConfirmingExit).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(message)
    }
  )

  it.each(SESSION_ID_ONLY)(
    'never closes the %s terminal when the reveal did not list the chat',
    async (name) => {
      const d = deps({ revealStructuredChat: vi.fn(async () => 'unreachable' as const) })

      await returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS[name] }, d)

      expect(d.closeTerminalTabConfirmingExit).not.toHaveBeenCalled()
    }
  )

  it.each(SESSION_ID_ONLY)(
    'does not show the %s chat and says the terminal may still run when its exit is not confirmed',
    async (name) => {
      const steps: string[] = []
      const d = deps({ closeTerminalTabConfirmingExit: vi.fn(async () => false) }, steps)

      await expect(
        returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS[name] }, d)
      ).resolves.toBe(false)

      expect(steps).toEqual(['revealed'])
      expect(d.activateStructuredChat).not.toHaveBeenCalled()
      expect(d.resumeInStructuredChat).not.toHaveBeenCalled()
      expect(mocks.toastError).toHaveBeenCalledWith(UNCONFIRMED)
    }
  )

  it.each(SESSION_ID_ONLY)(
    'says the %s chat is kept when it is revealed but cannot be shown after the terminal stopped',
    async (name) => {
      const d = deps({ activateStructuredChat: vi.fn(() => false) })

      await expect(
        returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS[name] }, d)
      ).resolves.toBe(false)

      expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledWith('terminal-tab-1')
      expect(mocks.toastError).toHaveBeenCalledWith(NOT_SHOWN)
    }
  )

  it.each(ADOPTABLE)(
    'adopts the %s session into a new chat only after the terminal confirmed its exit',
    async (name) => {
      const steps: string[] = []
      const d = deps(
        { revealStructuredChat: vi.fn(async () => 'host-cannot-open' as const) },
        steps
      )

      await expect(
        returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS[name] }, d)
      ).resolves.toBe(true)

      expect(steps).toEqual(['closed', 'resumed'])
      expect(d.resumeInStructuredChat).toHaveBeenCalledWith({
        agent: LINKS[name].agent,
        worktreeId: WORKTREE,
        providerSessionId: LINKS[name].providerSessionId,
        requestId: 'request-1',
        onFailed: expect.any(Function)
      })
      expect(mocks.toastError).not.toHaveBeenCalled()
    }
  )

  it('does not adopt a handle-backed chat while its terminal may still run', async () => {
    const d = deps({
      revealStructuredChat: vi.fn(async () => 'unreachable' as const),
      closeTerminalTabConfirmingExit: vi.fn(async () => false)
    })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS.claude }, d)
    ).resolves.toBe(false)

    expect(d.resumeInStructuredChat).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(UNCONFIRMED)
  })

  it('names the live terminal when the adopting host refuses because it still holds the session', async () => {
    const d = deps({
      revealStructuredChat: vi.fn(async () => 'gone' as const),
      resumeInStructuredChat: vi.fn((args: ResumeProviderSessionInNewChatArgs) => {
        args.onFailed(
          new StructuredAgentSessionCreateRefusalError('held', 'agent_session_conflict', {
            code: 'agent_session_conflict',
            details: { reason: 'ownerAlive' }
          })
        )
        return { sessionId: 'session-1' }
      })
    })

    await returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS.codex }, d)

    expect(mocks.toastError).toHaveBeenCalledWith(HELD_BY_TERMINAL)
  })

  it('reports the generic failure when an adoption launch cannot begin', async () => {
    const d = deps({
      revealStructuredChat: vi.fn(async () => 'gone' as const),
      resumeInStructuredChat: vi.fn(() => null)
    })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS.claude }, d)
    ).resolves.toBe(false)

    expect(mocks.toastError).toHaveBeenCalledWith(FAILED)
  })

  it('reports the generic failure when the terminal close throws', async () => {
    const d = deps({
      closeTerminalTabConfirmingExit: vi.fn(async () => {
        throw new Error('store unavailable')
      })
    })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINKS.antigravity }, d)
    ).resolves.toBe(false)

    expect(d.activateStructuredChat).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(FAILED)
  })

  it('runs one return per terminal while the first one is still in flight', async () => {
    let finishClose: (confirmed: boolean) => void = () => {}
    const d = deps({
      closeTerminalTabConfirmingExit: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finishClose = resolve
          })
      )
    })

    const first = returnTerminalToStructuredChat({ tabId: 'terminal-tab-2', link: LINKS.codex }, d)
    await vi.waitFor(() => expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledTimes(1))
    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-2', link: LINKS.codex }, d)
    ).resolves.toBe(false)
    finishClose(true)

    await expect(first).resolves.toBe(true)
    expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledTimes(1)
    expect(d.activateStructuredChat).toHaveBeenCalledTimes(1)
  })
})

describe('returnTerminalToStructuredChat while a switch of the same chat is underway', () => {
  it('ignores a return from another terminal of the same chat until the first settles', async () => {
    let finishClose: (confirmed: boolean) => void = () => {}
    const d = deps({
      closeTerminalTabConfirmingExit: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finishClose = resolve
          })
      )
    })

    const first = returnTerminalToStructuredChat({ tabId: 'terminal-tab-2', link: LINKS.codex }, d)
    await vi.waitFor(() => expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledTimes(1))
    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-3', link: LINKS.codex }, d)
    ).resolves.toBe(false)
    finishClose(true)
    await expect(first).resolves.toBe(true)

    expect(d.activateStructuredChat).toHaveBeenCalledTimes(1)
  })

  it('accepts a return again after the first one failed', async () => {
    const d = deps({ closeTerminalTabConfirmingExit: vi.fn(async () => false) })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-2', link: LINKS.claude }, d)
    ).resolves.toBe(false)
    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-2', link: LINKS.claude }, d)
    ).resolves.toBe(false)
    expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledTimes(2)
  })
})

describe('returnTerminalToStructuredChat for a fresh Gentle Shell terminal', () => {
  const FRESH: StructuredChatTerminalLink = {
    agent: 'pi',
    worktreeId: WORKTREE,
    structuredSessionId: 'gentle-shell-chat-2'
  }

  it('offers the return toggle for a link that names no provider session', () => {
    expect(terminalChatToggleRoute({ link: FRESH, chatViewActive: false, paneCount: 1 })).toEqual({
      kind: 'return-to-structured-chat',
      link: FRESH
    })
  })

  it('reopens the chat by its session id', async () => {
    const steps: string[] = []
    const d = deps({}, steps)

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: FRESH }, d)
    ).resolves.toBe(true)

    expect(steps).toEqual(['revealed', 'closed', 'activated'])
  })

  it('keeps the terminal when the chat cannot be listed, since there is no provider session to adopt', async () => {
    const d = deps({ revealStructuredChat: vi.fn(async () => 'gone' as const) })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: FRESH }, d)
    ).resolves.toBe(false)

    expect(d.closeTerminalTabConfirmingExit).not.toHaveBeenCalled()
  })
})

describe('terminalChatToggleRoute', () => {
  it('returns a single-pane terminal the structured chat opened to that chat', () => {
    expect(
      terminalChatToggleRoute({ link: LINKS.codex, chatViewActive: false, paneCount: 1 })
    ).toEqual({
      kind: 'return-to-structured-chat',
      link: LINKS.codex
    })
  })

  it('keeps the legacy toggle for a split terminal, even one the structured chat opened', () => {
    expect(
      terminalChatToggleRoute({ link: LINKS.codex, chatViewActive: false, paneCount: 2 })
    ).toEqual({ kind: 'legacy-toggle' })
  })

  it('keeps the legacy toggle for a terminal no structured chat opened', () => {
    expect(
      terminalChatToggleRoute({ link: undefined, chatViewActive: false, paneCount: 1 })
    ).toEqual({ kind: 'legacy-toggle' })
  })

  it('leaves an open legacy chat view to the legacy toggle, even for a linked terminal', () => {
    expect(
      terminalChatToggleRoute({ link: LINKS.codex, chatViewActive: true, paneCount: 1 })
    ).toEqual({ kind: 'legacy-toggle' })
  })
})

describe('revealStructuredChatTab', () => {
  const CHAT = { worktreeId: 'wt-1', sessionId: 'pi-chat-1' }

  beforeEach(() => {
    vi.clearAllMocks()
    chatHost.listed.mockReturnValue(false)
    chatHost.reveal.mockResolvedValue('revealed')
    chatHost.refresh.mockResolvedValue(undefined)
  })

  it('reports ready for a chat the inventory already lists, without revealing it', async () => {
    chatHost.listed.mockReturnValue(true)

    await expect(revealStructuredChatTab(CHAT)).resolves.toBe('ready')
    expect(chatHost.reveal).not.toHaveBeenCalled()
  })

  it('reveals a closed chat, applies the inventory before reporting it ready, and shows nothing', async () => {
    chatHost.listed.mockReturnValueOnce(false).mockReturnValue(true)

    await expect(revealStructuredChatTab(CHAT)).resolves.toBe('ready')
    expect(chatHost.reveal).toHaveBeenCalledWith(CHAT)
    expect(chatHost.refresh).toHaveBeenCalledWith('wt-1')
    expect(chatHost.activate).not.toHaveBeenCalled()
  })

  it('reports unreachable when the inventory refresh fails after a reveal', async () => {
    chatHost.refresh.mockRejectedValue(new Error('timeout'))

    await expect(revealStructuredChatTab(CHAT)).resolves.toBe('unreachable')
  })

  it('reports unreachable when the revealed chat still is not listed', async () => {
    await expect(revealStructuredChatTab(CHAT)).resolves.toBe('unreachable')
  })

  it.each(['gone', 'host-cannot-open', 'unreachable'] as const)(
    'passes a %s reveal through without refreshing the inventory',
    async (outcome) => {
      chatHost.reveal.mockResolvedValue(outcome)

      await expect(revealStructuredChatTab(CHAT)).resolves.toBe(outcome)
      expect(chatHost.refresh).not.toHaveBeenCalled()
    }
  )
})
