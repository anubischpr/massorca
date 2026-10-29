import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import {
  canStartMobileStructuredAgentSession,
  probeMobileStructuredAgentSessionSupport,
  startMobileStructuredAgentSession
} from './mobile-structured-agent-session-launch'

/** A client that answers each request in turn, in the order the flow sends them. */
function fakeClient(...responses: unknown[]) {
  let next = 0
  const sendRequest = vi.fn()
  sendRequest.mockImplementation(async () => responses[next++])
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
  return { client, sendRequest }
}

const acceptedPiCreate = {
  ok: true,
  result: {
    ok: true,
    replayed: false,
    fence: 2,
    cursor: { epoch: 'epoch-1', sequence: 0 },
    value: {
      sessionId: 'pi_session_1',
      fence: 2,
      page: {
        sessionId: 'pi_session_1',
        epoch: 'epoch-1',
        direction: 'tail',
        items: [],
        removedItemIds: [],
        submissions: [],
        window: { oldest: null, newest: null, nextCursor: { epoch: 'epoch-1', sequence: 0 } },
        liveCursor: { epoch: 'epoch-1', sequence: 0 },
        hasOlder: false,
        hasNewer: false
      },
      unconfirmedClientMessageIds: []
    }
  }
}

describe('Pi runtime on the structured create', () => {
  it('names the Gentle Shell runtime and access mode in the create and returns the fence', async () => {
    const { client, sendRequest } = fakeClient(
      { ok: true, result: { supported: true } },
      acceptedPiCreate
    )
    await expect(
      startMobileStructuredAgentSession(client, 'wt-1', 'pi', {
        piRuntime: 'gentle-shell',
        accessMode: 'full-access'
      })
    ).resolves.toEqual({ kind: 'created', sessionId: 'pi_session_1', fence: 2 })
    expect(sendRequest.mock.calls[0]?.[1]).toMatchObject({
      worktree: 'id:wt-1',
      agent: 'pi',
      piRuntime: 'gentle-shell'
    })
    expect(sendRequest.mock.calls[1]?.[1]).toMatchObject({
      agent: 'pi',
      piRuntime: 'gentle-shell',
      accessMode: 'full-access'
    })
  })

  it('sends no access mode for an agent that is not Pi', async () => {
    const { client, sendRequest } = fakeClient(
      { ok: true, result: { supported: true } },
      acceptedPiCreate
    )
    await startMobileStructuredAgentSession(client, 'wt-1', 'codex', {
      accessMode: 'full-access'
    })
    expect(sendRequest.mock.calls[1]?.[1]).not.toHaveProperty('accessMode')
  })

  it('keeps the host reason when the Gentle Shell probe says no', async () => {
    const missing = fakeClient({
      ok: true,
      result: { supported: false, reason: 'agent', cause: 'cliMissing' }
    })
    await expect(
      probeMobileStructuredAgentSessionSupport(missing.client, 'wt-1', 'pi', {
        piRuntime: 'gentle-shell'
      })
    ).resolves.toEqual({ supported: false, detail: 'The CLI was not found on the host.' })

    const refused = fakeClient({ ok: false, error: { code: 'invalid_params', message: '/home/x' } })
    await expect(
      probeMobileStructuredAgentSessionSupport(refused.client, 'wt-1', 'pi', {
        piRuntime: 'gentle-shell'
      })
    ).resolves.toEqual({ supported: false, detail: 'Host error: invalid_params.' })

    const odd = fakeClient({ ok: true, result: { supported: false, cause: '/usr/bin/pi' } })
    await expect(
      probeMobileStructuredAgentSessionSupport(odd.client, 'wt-1', 'pi', {
        piRuntime: 'gentle-shell'
      })
    ).resolves.toEqual({ supported: false, detail: '' })
  })

  it('asks whether the Gentle Shell chat can start, and says no to an unsupported or refused answer', async () => {
    const supported = fakeClient({ ok: true, result: { supported: true } })
    await expect(
      canStartMobileStructuredAgentSession(supported.client, 'wt-1', 'pi', {
        piRuntime: 'gentle-shell'
      })
    ).resolves.toBe(true)
    expect(supported.sendRequest.mock.calls[0]?.[1]).toMatchObject({
      worktree: 'id:wt-1',
      agent: 'pi',
      piRuntime: 'gentle-shell'
    })

    const unsupported = fakeClient({ ok: true, result: { supported: false } })
    await expect(
      canStartMobileStructuredAgentSession(unsupported.client, 'wt-1', 'pi', {
        piRuntime: 'gentle-shell'
      })
    ).resolves.toBe(false)

    const refused = fakeClient({ ok: false, error: { code: 'method_not_found', message: 'x' } })
    await expect(
      canStartMobileStructuredAgentSession(refused.client, 'wt-1', 'pi', {
        piRuntime: 'gentle-shell'
      })
    ).resolves.toBe(false)
  })
})
