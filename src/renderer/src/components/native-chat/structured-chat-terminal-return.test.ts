import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeProviderSessionInNewChatArgs } from '@/lib/provider-session-structured-chat-resume'
import { StructuredAgentSessionCreateRefusalError } from '@/lib/structured-agent-session-launch-errors'
import type { StructuredChatTerminalLink } from '../../store/terminals/terminal-contracts'
import {
  returnTerminalToStructuredChat,
  terminalChatToggleRoute,
  type StructuredChatTerminalReturnDeps
} from './structured-chat-terminal-return'

const mocks = vi.hoisted(() => ({ toastError: vi.fn<(message: string) => void>() }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
// Why: the default dependencies are never used here (each test passes its own), so the store graph stays unloaded.
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('../../store/terminals/terminal-tab-confirmed-close', () => ({
  closeTerminalTabConfirmingExit: vi.fn()
}))
vi.mock('@/lib/provider-session-structured-chat-resume', () => ({
  resumeProviderSessionInNewStructuredChat: vi.fn()
}))

const LINK: StructuredChatTerminalLink = {
  agent: 'codex',
  providerSessionId: 'thread-7',
  worktreeId: 'repo::/work/feature'
}
/** The launch of a chat that began. */
const BEGUN = { sessionId: 'session-1' }
const UNCONFIRMED =
  'Could not confirm the terminal stopped, so this chat was not reopened. The terminal may still be running.'
const HELD_BY_TERMINAL =
  'This conversation is still running in a terminal, so the chat was not reopened.'
const FAILED = 'Could not reopen this chat. Its terminal was closed and the conversation is kept.'

function deps(
  overrides: Partial<StructuredChatTerminalReturnDeps> = {}
): StructuredChatTerminalReturnDeps {
  return {
    closeTerminalTabConfirmingExit: vi.fn(async () => true),
    resumeInStructuredChat: vi.fn((_args: ResumeProviderSessionInNewChatArgs) => BEGUN),
    newRequestId: vi.fn(() => 'request-1'),
    ...overrides
  }
}

describe('returnTerminalToStructuredChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adopts the linked session into a new chat only after the terminal confirmed its exit', async () => {
    const order: string[] = []
    const d = deps({
      closeTerminalTabConfirmingExit: vi.fn(async () => {
        order.push('closed')
        return true
      }),
      resumeInStructuredChat: vi.fn((_args: ResumeProviderSessionInNewChatArgs) => {
        order.push('resumed')
        return BEGUN
      })
    })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINK }, d)
    ).resolves.toBe(true)

    expect(order).toEqual(['closed', 'resumed'])
    expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledWith('terminal-tab-1')
    expect(d.resumeInStructuredChat).toHaveBeenCalledWith({
      agent: 'codex',
      worktreeId: 'repo::/work/feature',
      providerSessionId: 'thread-7',
      requestId: 'request-1',
      onFailed: expect.any(Function)
    })
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('does not adopt and says the terminal may still run when its exit is not confirmed', async () => {
    const d = deps({ closeTerminalTabConfirmingExit: vi.fn(async () => false) })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINK }, d)
    ).resolves.toBe(false)

    expect(d.resumeInStructuredChat).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(UNCONFIRMED)
  })

  it('names the live terminal when the host refuses because it still holds the session', async () => {
    const d = deps({
      resumeInStructuredChat: vi.fn((args: ResumeProviderSessionInNewChatArgs) => {
        args.onFailed(
          new StructuredAgentSessionCreateRefusalError('held', 'agent_session_conflict', {
            code: 'agent_session_conflict',
            details: { reason: 'ownerAlive' }
          })
        )
        return BEGUN
      })
    })

    await returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINK }, d)

    expect(mocks.toastError).toHaveBeenCalledWith(HELD_BY_TERMINAL)
  })

  it('reports the generic failure for any other refusal', async () => {
    const d = deps({
      resumeInStructuredChat: vi.fn((args: ResumeProviderSessionInNewChatArgs) => {
        args.onFailed(new Error('host unreachable'))
        return BEGUN
      })
    })

    await returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINK }, d)

    expect(mocks.toastError).toHaveBeenCalledWith(FAILED)
  })

  it('reports the generic failure when the chat launch cannot begin', async () => {
    const d = deps({
      resumeInStructuredChat: vi.fn(() => {
        throw new Error('no workspace')
      })
    })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINK }, d)
    ).resolves.toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith(FAILED)
  })

  it('says the chat did not reopen and resolves false when the launch never began', async () => {
    const d = deps({
      resumeInStructuredChat: vi.fn((_args: ResumeProviderSessionInNewChatArgs) => null)
    })

    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-1', link: LINK }, d)
    ).resolves.toBe(false)

    expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledWith('terminal-tab-1')
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
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

    const first = returnTerminalToStructuredChat({ tabId: 'terminal-tab-2', link: LINK }, d)
    await expect(
      returnTerminalToStructuredChat({ tabId: 'terminal-tab-2', link: LINK }, d)
    ).resolves.toBe(false)
    finishClose(true)

    await expect(first).resolves.toBe(true)
    expect(d.closeTerminalTabConfirmingExit).toHaveBeenCalledTimes(1)
    expect(d.resumeInStructuredChat).toHaveBeenCalledTimes(1)
  })
})

describe('terminalChatToggleRoute', () => {
  it('returns a single-pane terminal the structured chat opened to that chat', () => {
    expect(terminalChatToggleRoute({ link: LINK, chatViewActive: false, paneCount: 1 })).toEqual({
      kind: 'return-to-structured-chat',
      link: LINK
    })
  })

  it('keeps the legacy toggle for a split terminal, even one the structured chat opened', () => {
    expect(terminalChatToggleRoute({ link: LINK, chatViewActive: false, paneCount: 2 })).toEqual({
      kind: 'legacy-toggle'
    })
  })

  it('keeps the legacy toggle for a terminal no structured chat opened', () => {
    expect(
      terminalChatToggleRoute({ link: undefined, chatViewActive: false, paneCount: 1 })
    ).toEqual({ kind: 'legacy-toggle' })
  })

  it('leaves an open legacy chat view to the legacy toggle, even for a linked terminal', () => {
    expect(terminalChatToggleRoute({ link: LINK, chatViewActive: true, paneCount: 1 })).toEqual({
      kind: 'legacy-toggle'
    })
  })
})
