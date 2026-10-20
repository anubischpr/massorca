import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as admission from '@/lib/structured-agent-session-host-admission'

const askHostCreateSupport = vi.hoisted(() => vi.fn())
const resolveOwner = vi.hoisted(() => vi.fn<() => string | null>())
const store = vi.hoisted((): { settings: { agentCmdOverrides: Record<string, string> } } => ({
  settings: { agentCmdOverrides: {} }
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))
vi.mock('@/lib/structured-agent-session-host-admission', async (importOriginal) => {
  const actual = await importOriginal<typeof admission>()
  return { ...actual, askHostCreateSupport }
})
vi.mock('@/runtime/structured-agent-session-owner', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveStructuredAgentSessionOwner: () => resolveOwner(),
  structuredAgentSessionTargetForHost: () => ({ kind: 'local' as const })
}))

import { resolvePiRuntimeForLaunch } from './pi-terminal-host-runtime'

function hostAnswers(runtime: 'pi' | 'gentle-shell'): void {
  askHostCreateSupport.mockResolvedValue(
    runtime === 'gentle-shell'
      ? { kind: 'admitted', seedOptions: { piRuntime: 'gentle-shell' } }
      : { kind: 'admitted' }
  )
}

describe('resolvePiRuntimeForLaunch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.settings = { agentCmdOverrides: {} }
    resolveOwner.mockReturnValue('local')
    hostAnswers('pi')
  })

  it('takes a Gentle Shell session as final with no client Pi setting and a stock host', async () => {
    await expect(
      resolvePiRuntimeForLaunch({ worktreeId: 'wt-1', sessionRuntime: 'gentle-shell' })
    ).resolves.toBe('gentle-shell')
    expect(askHostCreateSupport).not.toHaveBeenCalled()
  })

  it('keeps a stock Pi session on pi even when the client Pi setting names Gentle Shell', async () => {
    store.settings.agentCmdOverrides = { pi: 'gentle-shell' }
    hostAnswers('gentle-shell')

    await expect(
      resolvePiRuntimeForLaunch({ worktreeId: 'wt-1', sessionRuntime: 'pi' })
    ).resolves.toBe('pi')
    expect(askHostCreateSupport).not.toHaveBeenCalled()
  })

  it('asks the workspace host when the session has no evidence, so a Gentle Shell-only host runs gentle-shell', async () => {
    hostAnswers('gentle-shell')

    await expect(resolvePiRuntimeForLaunch({ worktreeId: 'wt-1' })).resolves.toBe('gentle-shell')
    expect(askHostCreateSupport).toHaveBeenCalledWith({ kind: 'local' }, 'wt-1', 'pi')
  })

  it('runs stock pi when the host has it, did not answer, or has neither', async () => {
    hostAnswers('pi')
    await expect(resolvePiRuntimeForLaunch({ worktreeId: 'wt-1' })).resolves.toBe('pi')

    askHostCreateSupport.mockResolvedValue({ kind: 'declined' })
    await expect(resolvePiRuntimeForLaunch({ worktreeId: 'wt-1' })).resolves.toBe('pi')

    askHostCreateSupport.mockResolvedValue({ kind: 'declined', cause: 'cliMissing' })
    await expect(resolvePiRuntimeForLaunch({ worktreeId: 'wt-1' })).resolves.toBe('pi')
  })

  it('honors an explicit client Pi command for a session with no evidence, without asking the host', async () => {
    hostAnswers('gentle-shell')
    store.settings.agentCmdOverrides = { pi: '/opt/pi --fast' }
    await expect(resolvePiRuntimeForLaunch({ worktreeId: 'wt-1' })).resolves.toBe('pi')

    store.settings.agentCmdOverrides = { pi: '/opt/gentle/gentle-shell' }
    await expect(resolvePiRuntimeForLaunch({ worktreeId: 'wt-1' })).resolves.toBe('gentle-shell')
    expect(askHostCreateSupport).not.toHaveBeenCalled()
  })

  it('uses the client Pi command when no runtime serves the workspace host', async () => {
    resolveOwner.mockReturnValue(null)
    hostAnswers('gentle-shell')

    await expect(resolvePiRuntimeForLaunch({ worktreeId: 'wt-1' })).resolves.toBe('pi')
    expect(askHostCreateSupport).not.toHaveBeenCalled()
  })
})
