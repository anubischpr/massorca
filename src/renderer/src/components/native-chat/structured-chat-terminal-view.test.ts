import { describe, expect, it, vi } from 'vitest'
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import type { RuntimeClientTarget } from '../../runtime/runtime-rpc-client'
import {
  showStructuredChatInTerminal,
  type ShowStructuredChatInTerminalArgs,
  type ShowStructuredChatInTerminalDeps
} from './structured-chat-terminal-view'

const LOCAL: RuntimeClientTarget = { kind: 'local' }

function args(
  overrides: Partial<ShowStructuredChatInTerminalArgs> = {}
): ShowStructuredChatInTerminalArgs {
  return {
    target: LOCAL,
    tabId: 'agent-session-tab-1',
    worktreeId: 'repo::/work/feature',
    paneKey: 'agent-session-tab-1:session-1',
    sessionId: 'session-1',
    agent: 'claude',
    providerSession: { key: 'session_id', id: 'provider-1' },
    ...overrides
  }
}

/** Deps whose launch opens the terminal as `launchedTabId` (or reports no tab when null). */
function deps(
  overrides: Partial<ShowStructuredChatInTerminalDeps> = {},
  launchedTabId: string | null = 'terminal-tab-9'
): ShowStructuredChatInTerminalDeps {
  return {
    releaseProviderChild: vi.fn(async () => 'closed' as const),
    launchResume: vi.fn(
      (
        _record: SleepingAgentSessionRecord,
        options: { onSessionLaunched: (tabId: string) => void }
      ) => {
        if (launchedTabId !== null) {
          options.onSessionLaunched(launchedTabId)
        }
        return true
      }
    ),
    recordTerminalLink: vi.fn(),
    closeChatTab: vi.fn(),
    onReleaseFailed: vi.fn(),
    onLaunchFailedAfterRelease: vi.fn(),
    now: () => 1000,
    ...overrides
  }
}

describe('showStructuredChatInTerminal', () => {
  it.each(['claude', 'codex'] as const)(
    'links the %s terminal to its provider session, then closes the chat',
    async (agent) => {
      const d = deps()

      await expect(showStructuredChatInTerminal(args({ agent }), d)).resolves.toBe(true)

      expect(d.recordTerminalLink).toHaveBeenCalledWith('terminal-tab-9', {
        agent,
        providerSessionId: 'provider-1',
        worktreeId: 'repo::/work/feature'
      })
      expect(d.closeChatTab).toHaveBeenCalledWith('agent-session-tab-1')
    }
  )

  it('records no link for an agent that structured adoption does not support', async () => {
    const d = deps()

    await expect(showStructuredChatInTerminal(args({ agent: 'gemini' }), d)).resolves.toBe(true)

    expect(d.recordTerminalLink).not.toHaveBeenCalled()
    expect(d.closeChatTab).toHaveBeenCalledWith('agent-session-tab-1')
  })

  it('records no link when the launch reports no terminal tab', async () => {
    const d = deps({}, null)

    await expect(showStructuredChatInTerminal(args(), d)).resolves.toBe(true)

    expect(d.recordTerminalLink).not.toHaveBeenCalled()
  })

  it('records no link and keeps the chat open when the terminal did not start', async () => {
    const d = deps({ launchResume: vi.fn(() => false) })

    await expect(showStructuredChatInTerminal(args(), d)).resolves.toBe(false)

    expect(d.recordTerminalLink).not.toHaveBeenCalled()
    expect(d.closeChatTab).not.toHaveBeenCalled()
    expect(d.onLaunchFailedAfterRelease).toHaveBeenCalledTimes(1)
  })

  it('launches nothing and records nothing when the provider child cannot be released', async () => {
    const d = deps({ releaseProviderChild: vi.fn(async () => 'unsupported' as const) })

    await expect(showStructuredChatInTerminal(args(), d)).resolves.toBe(false)

    expect(d.launchResume).not.toHaveBeenCalled()
    expect(d.recordTerminalLink).not.toHaveBeenCalled()
    expect(d.onReleaseFailed).toHaveBeenCalledTimes(1)
  })
})
