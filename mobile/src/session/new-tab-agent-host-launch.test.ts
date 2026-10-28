import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import { launchNewTabAgentThroughHost } from './new-tab-agent-host-launch'

vi.mock('../platform/haptics', () => ({ triggerError: vi.fn(), triggerSuccess: vi.fn() }))

const CAPABILITIES = [
  'agent.launch.v2',
  'agent.launch.replay.v1',
  'agent.launch.replay-required.v1'
]

function ok(result: unknown): RpcResponse {
  return { id: '1', ok: true, result, _meta: { runtimeId: 'r' } }
}

function structuredReceipt(): RpcResponse {
  return ok({
    worktreeId: 'wt-1',
    outcome: { kind: 'structured', sessionId: 'claude-1', handle: 'h' },
    receipt: {
      mode: 'structured',
      preferred: 'structured',
      reason: 'user_default',
      detail: 'Chat.'
    },
    prompt: { delivery: 'submit', outcome: 'journaled', messageId: 'm' }
  })
}

function terminalReceipt(): RpcResponse {
  return ok({
    worktreeId: 'wt-1',
    outcome: { kind: 'terminal', handle: 'term-1' },
    receipt: {
      mode: 'terminal',
      preferred: 'terminal',
      reason: 'user_default',
      detail: 'Started a terminal agent, the default for new agent tabs in your settings.'
    },
    prompt: { delivery: 'submit', outcome: 'handed-to-terminal' }
  })
}

function harness(reply: RpcResponse, hostCapabilities: readonly string[] = CAPABILITIES) {
  const sendRequest = vi.fn(async (_method: string, _params?: unknown, _options?: unknown) => reply)
  const client: RpcClient = {
    sendRequest,
    subscribe: () => () => {},
    updateTerminalSubscriptionViewport: () => {},
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => null,
    onStateChange: () => () => {},
    notifyForeground: () => {},
    close: () => {}
  }
  const showToast = vi.fn()
  const run = () =>
    launchNewTabAgentThroughHost({
      client,
      hostCapabilities,
      worktreeId: 'wt-1',
      agent: 'claude',
      options: { agentPrompt: 'Fix it' },
      lock: 'lock-1',
      pendingSelectionRef: { current: null },
      fetchSessionTabs: async () => {},
      getSessionTabs: () => [],
      showToast,
      reportCreateFailure: vi.fn(),
      setCreateError: vi.fn()
    })
  return { run, sendRequest, showToast }
}

describe('the new-tab agent launch', () => {
  it('asks the host for a chat', async () => {
    const { run, sendRequest } = harness(structuredReceipt())
    await run()
    expect(sendRequest.mock.calls[0]?.[0]).toBe('agent.launchReplay')
    expect(sendRequest.mock.calls[0]?.[1]).toMatchObject({ agent: 'claude', preferredMode: 'chat' })
  })

  it('stays quiet when the host built the chat', async () => {
    const { run, showToast } = harness(structuredReceipt())
    await run()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('says so, with the host reason, when it built a terminal', async () => {
    const { run, showToast } = harness(terminalReceipt())
    await run()
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/not a chat.*default for new agent tabs/),
      3200
    )
  })

  it('hands an older host back to the caller, saying it opens its default kind of tab', async () => {
    const { run, sendRequest, showToast } = harness(structuredReceipt(), ['agent.launch.v2'])
    await expect(run()).resolves.toBe(false)
    expect(sendRequest).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/default kind of tab/), 3200)
  })
})
