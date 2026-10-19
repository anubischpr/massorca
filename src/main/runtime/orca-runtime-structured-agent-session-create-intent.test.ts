import { beforeEach, describe, expect, it, vi } from 'vitest'

const applyAgentWorkspaceTrust = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('../agent-workspace-trust', () => ({ applyAgentWorkspaceTrust }))

import { OrcaRuntimeService } from './orca-runtime'
import { paneKeyPtyId } from '../ipc/pty/pane/key-state'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../shared/constants'
import { attachFingerprintFields } from '../native-chat/agent-session-wire/structured-agent-session-attach'

beforeEach(() => {
  applyAgentWorkspaceTrust.mockClear()
})

function createCodexIntentRuntime(
  settings: Record<string, unknown>,
  workspaceId = 'workspace-1',
  workspacePath = '/repos/workspace-1'
) {
  const prepareCodexStructuredLaunch = vi.fn(() => '/accounts/selected/home')
  const runtime = new OrcaRuntimeService(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: create intent only reads getSettings from the store.
    { getSettings: () => ({ agentDefaultEnv: { codex: {} }, ...settings }) } as never,
    undefined,
    { prepareCodexStructuredLaunch }
  )
  vi.spyOn(runtime, 'getStructuredAgentSessionCreateSupport').mockResolvedValue({
    supported: true
  })
  Object.assign(runtime, {
    resolveStructuredAgentSessionLocation: vi.fn(async () => ({
      executionHostId: 'local',
      wslDistro: null,
      workspaceId,
      workspaceKind: 'git-worktree' as const
    })),
    resolveRuntimeFileTarget: vi.fn(async () => ({ worktree: { path: workspacePath } }))
  })
  const createIntent = () =>
    runtime.resolveStructuredAgentSessionCreateIntent({
      envelope: { sessionId: 'session-1', clientOperationId: 'operation-1' },
      worktree: `id:${workspaceId}`,
      agent: 'codex'
    })
  return { prepareCodexStructuredLaunch, createIntent }
}

describe('structured Codex folder trust', () => {
  it('takes a floating chat directory from the host-resolved workspace', async () => {
    const { createIntent } = createCodexIntentRuntime(
      {},
      FLOATING_TERMINAL_WORKTREE_ID,
      '/host/floating-folder'
    )

    const intent = await createIntent()

    expect(intent.hostLaunchDirectory).toBe('/host/floating-folder')
    expect(applyAgentWorkspaceTrust).toHaveBeenCalledWith(
      'codex',
      '/host/floating-folder',
      expect.any(Object)
    )
    expect(attachFingerprintFields(intent)).not.toHaveProperty('hostLaunchDirectory')
  })

  it('pre-trusts the chat folder before launch preparation, as a Codex terminal launch does', async () => {
    const { prepareCodexStructuredLaunch, createIntent } = createCodexIntentRuntime({})

    await createIntent()

    expect(applyAgentWorkspaceTrust).toHaveBeenCalledWith('codex', '/repos/workspace-1', {
      env: expect.any(Object),
      claudeAuth: null,
      wslDistro: null,
      connectionId: null
    })
    expect(applyAgentWorkspaceTrust.mock.invocationCallOrder[0]).toBeLessThan(
      prepareCodexStructuredLaunch.mock.invocationCallOrder[0]
    )
  })

  it('writes nothing with the setting off, and still prepares the launch', async () => {
    const { prepareCodexStructuredLaunch, createIntent } = createCodexIntentRuntime({
      agentWorkspaceTrustEnabled: false
    })

    await createIntent()

    expect(applyAgentWorkspaceTrust).not.toHaveBeenCalled()
    expect(prepareCodexStructuredLaunch).toHaveBeenCalledTimes(1)
  })
})

describe('structured agent-session create intent', () => {
  it('pins the selected Codex launch home after normal launch preparation', async () => {
    const prepareCodexStructuredLaunch = vi.fn(() => '/accounts/selected/home')
    const runtime = new OrcaRuntimeService(
      {
        getSettings: () => ({
          agentDefaultEnv: { codex: { CODEX_HOME: '/configured/home' } },
          nativeChatSessionOptions: {
            codex: {
              model: 'gpt-5.6-sol',
              valuesByModel: {
                'gpt-5.6-sol': { effort: 'medium', fastMode: true, personality: 'concise' }
              }
            }
          }
        })
      } as never,
      undefined,
      { prepareCodexStructuredLaunch }
    )
    vi.spyOn(runtime, 'getStructuredAgentSessionCreateSupport').mockResolvedValue({
      supported: true
    })
    const internal = runtime as unknown as {
      resolveStructuredAgentSessionLocation: (selector: string) => Promise<{
        executionHostId: string
        wslDistro: null
        workspaceId: string
        workspaceKind: 'git-worktree'
      }>
      resolveRuntimeFileTarget: (selector: string) => Promise<{
        worktree: { path: string }
      }>
    }
    internal.resolveStructuredAgentSessionLocation = vi.fn(async () => ({
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'workspace-1',
      workspaceKind: 'git-worktree' as const
    }))
    internal.resolveRuntimeFileTarget = vi.fn(async () => ({
      worktree: { path: '/repos/workspace-1' }
    }))

    const intent = await runtime.resolveStructuredAgentSessionCreateIntent({
      envelope: { sessionId: 'session-1', clientOperationId: 'operation-1' },
      worktree: 'id:workspace-1',
      agent: 'codex'
    })

    expect(prepareCodexStructuredLaunch).toHaveBeenCalledWith({
      launchEnv: expect.objectContaining({ CODEX_HOME: '/configured/home' })
    })
    expect(intent.accountHome).toEqual({
      variable: 'CODEX_HOME',
      path: '/accounts/selected/home'
    })
    expect(intent.options).toEqual({ model: 'gpt-5.6-sol', effort: 'medium', fastMode: 'true' })
  })

  it('resolves the record-less catalog account home read-only, never through launch preparation', async () => {
    const prepareCodexStructuredLaunch = vi.fn(() => '/accounts/selected/home')
    const resolveCodexStructuredLaunchHome = vi.fn(() => '/accounts/selected/home')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the account-home read only consumes getSettings from the store.
    const store = {
      getSettings: () => ({
        agentDefaultEnv: { codex: { CODEX_HOME: '/configured/home' } }
      })
    } as never
    const runtime = new OrcaRuntimeService(store, undefined, {
      prepareCodexStructuredLaunch,
      resolveCodexStructuredLaunchHome
    })

    const accountHome = await runtime.resolveStructuredAgentAccountHome('codex')

    // A read must not run launch preparation: no home sync, no session bridge,
    // no cleared account selection — the read-only sibling answers instead.
    expect(prepareCodexStructuredLaunch).not.toHaveBeenCalled()
    expect(resolveCodexStructuredLaunchHome).toHaveBeenCalledWith({
      launchEnv: expect.objectContaining({ CODEX_HOME: '/configured/home' })
    })
    expect(accountHome).toEqual({ variable: 'CODEX_HOME', path: '/accounts/selected/home' })
  })

  it('pins the configured Claude launch home without Codex launch preparation', async () => {
    const prepareCodexStructuredLaunch = vi.fn()
    const runtime = new OrcaRuntimeService(
      {
        getSettings: () => ({
          agentDefaultEnv: {
            claude: { CLAUDE_CONFIG_DIR: '/configured/claude-home' }
          },
          nativeChatSessionOptions: {
            claude: {
              model: 'opus',
              valuesByModel: { opus: { effort: 'high', fastMode: true } }
            }
          }
        })
      } as never,
      undefined,
      { prepareCodexStructuredLaunch }
    )
    vi.spyOn(runtime, 'getStructuredAgentSessionCreateSupport').mockResolvedValue({
      supported: true
    })
    const internal = runtime as unknown as {
      resolveStructuredAgentSessionLocation: (selector: string) => Promise<{
        executionHostId: string
        wslDistro: null
        workspaceId: string
        workspaceKind: 'git-worktree'
      }>
      resolveRuntimeFileTarget: (selector: string) => Promise<{
        worktree: { path: string }
      }>
    }
    internal.resolveStructuredAgentSessionLocation = vi.fn(async () => ({
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'workspace-1',
      workspaceKind: 'git-worktree' as const
    }))
    internal.resolveRuntimeFileTarget = vi.fn(async () => ({
      worktree: { path: '/repos/workspace-1' }
    }))

    const intent = await runtime.resolveStructuredAgentSessionCreateIntent({
      envelope: { sessionId: 'session-1', clientOperationId: 'operation-1' },
      worktree: 'id:workspace-1',
      agent: 'claude'
    })

    expect(prepareCodexStructuredLaunch).not.toHaveBeenCalled()
    // Claude was never pre-trusted for a structured chat.
    expect(applyAgentWorkspaceTrust).not.toHaveBeenCalled()
    expect(intent.accountHome).toEqual({
      variable: 'CLAUDE_CONFIG_DIR',
      path: '/configured/claude-home'
    })
    expect(intent.options).toEqual({ model: 'opus', effort: 'high', fastMode: 'true' })
    // createSupport reports this same seed, so a paired client's picker shows what create runs.
    expect(runtime.structuredAgentSessionLaunchSeedOptions('claude')).toEqual(intent.options)
  })

  it('uses the managed Claude launch home before falling back to ~/.claude', async () => {
    const prepareCodexStructuredLaunch = vi.fn()
    const getRuntimeConfigDir = vi.fn(() => '/accounts/managed/claude-home')
    const runtime = new OrcaRuntimeService(
      {
        getSettings: () => ({
          agentDefaultEnv: { claude: {} }
        })
      } as never,
      undefined,
      { prepareCodexStructuredLaunch }
    )
    runtime.setAccountServices({
      claudeAccounts: { getRuntimeConfigDir } as never,
      codexAccounts: {} as never,
      rateLimits: {} as never
    })
    vi.spyOn(runtime, 'getStructuredAgentSessionCreateSupport').mockResolvedValue({
      supported: true
    })
    const internal = runtime as unknown as {
      resolveStructuredAgentSessionLocation: (selector: string) => Promise<{
        executionHostId: string
        wslDistro: null
        workspaceId: string
        workspaceKind: 'git-worktree'
      }>
      resolveRuntimeFileTarget: (selector: string) => Promise<{
        worktree: { path: string }
      }>
    }
    internal.resolveStructuredAgentSessionLocation = vi.fn(async () => ({
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'workspace-1',
      workspaceKind: 'git-worktree' as const
    }))
    internal.resolveRuntimeFileTarget = vi.fn(async () => ({
      worktree: { path: '/repos/workspace-1' }
    }))

    const intent = await runtime.resolveStructuredAgentSessionCreateIntent({
      envelope: { sessionId: 'session-1', clientOperationId: 'operation-1' },
      worktree: 'id:workspace-1',
      agent: 'claude'
    })

    expect(getRuntimeConfigDir).toHaveBeenCalledTimes(1)
    expect(intent.accountHome).toEqual({
      variable: 'CLAUDE_CONFIG_DIR',
      path: '/accounts/managed/claude-home'
    })
  })
})

describe('structured adoption while a terminal runs the session', () => {
  const TERMINAL_PANE_KEY = 'terminal-tab:terminal-leaf'
  const PROVIDER_SESSION_ID = 'provider-session-held-by-tui'

  function createAdoptionRuntime() {
    const runtime = new OrcaRuntimeService(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: create intent only reads getSettings from the store.
      {
        getSettings: () => ({
          agentDefaultEnv: { claude: { CLAUDE_CONFIG_DIR: '/configured/claude-home' } }
        })
      } as never,
      undefined,
      {
        getAgentProviderSessionSnapshot: () =>
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the guard reads only paneKey and providerSession.id.
          [
            {
              paneKey: TERMINAL_PANE_KEY,
              providerSession: { key: 'claude', id: PROVIDER_SESSION_ID }
            }
          ] as never
      }
    )
    vi.spyOn(runtime, 'getStructuredAgentSessionCreateSupport').mockResolvedValue({
      supported: true
    })
    Object.assign(runtime, {
      resolveStructuredAgentSessionLocation: vi.fn(async () => ({
        executionHostId: 'local',
        wslDistro: null,
        workspaceId: 'workspace-1',
        workspaceKind: 'git-worktree' as const
      })),
      resolveRuntimeFileTarget: vi.fn(async () => ({ worktree: { path: '/repos/workspace-1' } }))
    })
    return () =>
      runtime.resolveStructuredAgentSessionCreateIntent({
        envelope: { sessionId: 'session-1', clientOperationId: 'operation-1' },
        worktree: 'id:workspace-1',
        agent: 'claude',
        resumeFrom: { providerSessionId: PROVIDER_SESSION_ID }
      })
  }

  it('refuses while the pane that reports the session still has a PTY', async () => {
    paneKeyPtyId.set(TERMINAL_PANE_KEY, 'pty-held-by-tui')
    try {
      await expect(createAdoptionRuntime()()).rejects.toMatchObject({
        refusal: { code: 'agent_session_conflict', details: { reason: 'ownerAlive' } }
      })
    } finally {
      paneKeyPtyId.delete(TERMINAL_PANE_KEY)
    }
  })

  it('does not refuse for the terminal once its PTY is gone', async () => {
    const createIntent = createAdoptionRuntime()

    // The conversation has no transcript in this fixture, so adoption fails later and for another reason.
    await expect(createIntent()).rejects.not.toMatchObject({
      refusal: { details: { reason: 'ownerAlive' } }
    })
  })
})
