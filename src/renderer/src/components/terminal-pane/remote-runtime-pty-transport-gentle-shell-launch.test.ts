import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// A paired host rebuilds an agent launch from its own settings, so Gentle Shell must travel as its command.
describe('createRemoteRuntimePtyTransport Gentle Shell launch', () => {
  const runtimeCall = vi.fn()
  const runtimeSubscribe = vi.fn()

  // Why: the transport's first transform is slow, and it must not count against a test's own timeout.
  beforeAll(async () => {
    await import('./remote-runtime-pty-transport')
  }, 120_000)

  beforeEach(() => {
    vi.resetModules()
    runtimeCall.mockReset()
    runtimeSubscribe.mockReset()
    runtimeCall.mockImplementation(async (args: { method?: string }) =>
      args.method === 'status.get'
        ? {
            id: 'rpc-status',
            ok: true,
            result: {
              runtimeProtocolVersion: 3,
              minCompatibleRuntimeClientVersion: 2,
              capabilities: ['agent-session.host-authority.v1']
            },
            _meta: { runtimeId: 'runtime-remote' }
          }
        : {
            id: 'rpc-create',
            ok: true,
            result: {
              terminal: {
                handle: 'term-remote',
                worktreeId: 'repo1::/remote/wt',
                title: null,
                surface: 'background'
              }
            },
            _meta: { runtimeId: 'runtime-remote' }
          }
    )
    runtimeSubscribe.mockImplementation(
      async (_args: unknown, callbacks: { onResponse: (response: unknown) => void }) => {
        queueMicrotask(() =>
          callbacks.onResponse({
            id: 'rpc-multiplex',
            ok: true,
            result: { type: 'ready' },
            _meta: { runtimeId: 'runtime-remote' }
          })
        )
        return { unsubscribe: vi.fn(), sendBinary: vi.fn() }
      }
    )
    vi.stubGlobal('window', {
      api: { runtimeEnvironments: { call: runtimeCall, subscribe: runtimeSubscribe } }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function connectPiLaunch(command: string, extra: Record<string, unknown> = {}) {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'repo1::/remote/wt',
      command,
      launchAgent: 'pi',
      tabId: 'tab-1',
      leafId: '11111111-1111-4111-8111-111111111111',
      ...extra
    })
    await transport.connect({ url: '', callbacks: {} })
  }

  it('types gentle-shell for a fresh Gentle Shell launch instead of letting the host build pi', async () => {
    await connectPiLaunch('gentle-shell')

    expect(runtimeCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'terminal.create',
        params: expect.objectContaining({ command: 'gentle-shell', launchAgent: 'pi' })
      })
    )
    expect(runtimeCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'terminal.createAgentSession' })
    )
  })

  it('hands the provisional tab to the host tab so the back-to-chat link follows it', async () => {
    runtimeCall.mockImplementation(async (args: { method?: string }) =>
      args.method === 'status.get'
        ? {
            id: 'rpc-status',
            ok: true,
            result: {
              runtimeProtocolVersion: 3,
              minCompatibleRuntimeClientVersion: 2,
              capabilities: ['agent-session.host-authority.v1']
            },
            _meta: { runtimeId: 'runtime-remote' }
          }
        : {
            id: 'rpc-create',
            ok: true,
            result: {
              terminal: {
                handle: 'term-remote',
                tabId: 'host-tab-1',
                worktreeId: 'repo1::/remote/wt',
                title: null,
                surface: 'background'
              }
            },
            _meta: { runtimeId: 'runtime-remote' }
          }
    )
    await connectPiLaunch('gentle-shell')

    const { resolveWebAgentSessionHandoff } = await import('@/runtime/web-agent-session-handoff')
    expect(
      resolveWebAgentSessionHandoff({
        environmentId: 'env-1',
        worktreeId: 'repo1::/remote/wt',
        provisionalTabId: 'tab-1'
      })
    ).toBe('host-tab-1')
  })

  it('resumes a Gentle Shell session with its own command', async () => {
    await connectPiLaunch(
      "gentle-shell -- --session '/home/u/.gentle-shell/agent/sessions/a.jsonl'",
      {
        resumeProviderSession: {
          key: 'transcript_path',
          id: 'a',
          transcriptPath: '/home/u/.gentle-shell/agent/sessions/a.jsonl'
        }
      }
    )

    expect(runtimeCall).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'terminal.create',
        params: expect.objectContaining({
          command: "gentle-shell -- --session '/home/u/.gentle-shell/agent/sessions/a.jsonl'"
        })
      })
    )
    expect(runtimeCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'terminal.ensureAgentSession' })
    )
  })

  it('still lets the host build a stock Pi launch', async () => {
    await connectPiLaunch('pi')

    expect(runtimeCall).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'terminal.createAgentSession' })
    )
  })
})
