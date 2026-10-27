import { describe, expect, it, vi } from 'vitest'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE,
  launchCreateSession
} from './create-session-launch'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'

const repo: MobileWorkspaceRepo = { id: 'web', displayName: 'web', path: '/work/web' }
const RECEIPT = {
  mode: 'structured',
  preferred: 'structured',
  reason: 'user_default',
  detail: 'Started a chat.'
}

function ok(result: unknown): RpcResponse {
  return { id: '1', ok: true, result, _meta: { runtimeId: 'r' } }
}

function refused(code: string, message: string): RpcResponse {
  return { id: '1', ok: false, error: { code, message }, _meta: { runtimeId: 'r' } }
}

function launchReceipt(prompt: unknown): RpcResponse {
  return ok({
    worktreeId: 'wt-new',
    outcome: { kind: 'structured', sessionId: 'claude-1', handle: 'h' },
    receipt: RECEIPT,
    ...(prompt ? { prompt } : {})
  })
}

function fakeClient(replies: Record<string, RpcResponse>) {
  const sendRequest = vi.fn(async (method: string, _params?: unknown, _options?: unknown) => {
    return replies[method] ?? refused('method_not_found', `Unknown method: ${method}`)
  })
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

function paramsOf(sendRequest: ReturnType<typeof fakeClient>['sendRequest'], method: string) {
  return sendRequest.mock.calls.find(([called]) => called === method)?.[1]
}

const newWorktreePlan: CreateSessionLaunchPlan = {
  kind: 'new-worktree',
  repoId: 'web',
  agent: 'claude',
  prompt: 'fix the login bug',
  sessionOptions: { model: 'opus', accessMode: 'plan' }
}

const catalog = ok({
  snapshotId: 's1',
  worktrees: [
    { worktreeId: 'web::/work/web-feature', repoId: 'web', path: '/work/web-feature' },
    { worktreeId: 'web::/work/web', repoId: 'web', path: '/work/web', isMainWorktree: true }
  ]
})

function run(
  client: RpcClient,
  plan: CreateSessionLaunchPlan,
  support: { replay: boolean } | false
) {
  return launchCreateSession({
    client,
    hostId: 'host-1',
    repo,
    plan,
    agentLaunchSupport: Promise.resolve(support),
    worktreeCreateIdempotency: Promise.resolve(false)
  })
}

describe('launchCreateSession on an older host', () => {
  it('creates nothing and asks for an update', async () => {
    const { client, sendRequest } = fakeClient({})
    const result = await run(client, newWorktreePlan, false)
    expect(result).toEqual({
      ok: false,
      message: 'Update MassOrca on your computer to start an agent from your phone.'
    })
    expect(sendRequest).not.toHaveBeenCalled()
  })
})

describe('launchCreateSession in a new worktree', () => {
  it('creates the worktree and starts the chat with the message and options', async () => {
    const { client, sendRequest } = fakeClient({
      'worktree.ps': catalog,
      'agent.launch': launchReceipt({ delivery: 'submit', outcome: 'journaled', messageId: 'm1' })
    })
    const result = await run(client, newWorktreePlan, { replay: false })
    expect(result).toMatchObject({ ok: true, worktreeId: 'wt-new' })
    expect(result).not.toHaveProperty('warning')
    const params = paramsOf(sendRequest, 'agent.launch')
    expect(params).toMatchObject({
      agent: 'claude',
      prompt: { text: 'fix the login bug', delivery: 'submit' },
      sessionOptions: { model: 'opus', accessMode: 'plan' },
      target: { kind: 'create-worktree', create: { repo: 'id:web', setupDecision: 'inherit' } }
    })
  })

  it('warns when the host does not confirm the first message', async () => {
    const { client } = fakeClient({
      'worktree.ps': catalog,
      'agent.launch': launchReceipt({ delivery: 'submit', outcome: 'not-delivered' })
    })
    const result = await run(client, newWorktreePlan, { replay: false })
    expect(result).toMatchObject({
      ok: true,
      warning: CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE
    })
  })

  it('warns when the receipt says nothing about the message', async () => {
    const { client } = fakeClient({ 'agent.launch': launchReceipt(null) })
    const result = await run(client, newWorktreePlan, { replay: false })
    expect(result).toMatchObject({ ok: true, warning: CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE })
  })

  it('returns the host message when the create is refused', async () => {
    const { client } = fakeClient({
      'agent.launch': refused('internal_error', 'SSH connection is not available')
    })
    expect(await run(client, newWorktreePlan, { replay: false })).toEqual({
      ok: false,
      message: 'SSH connection is not available'
    })
  })

  it('sends no options when none were picked', async () => {
    const { client, sendRequest } = fakeClient({
      'agent.launch': launchReceipt({ delivery: 'submit', outcome: 'journaled', messageId: 'm' })
    })
    const { sessionOptions: _dropped, ...plain } = newWorktreePlan
    await run(client, plain, { replay: false })
    expect(paramsOf(sendRequest, 'agent.launch')).not.toHaveProperty('sessionOptions')
  })
})

describe('launchCreateSession in the current checkout', () => {
  const checkoutPlan: CreateSessionLaunchPlan = { ...newWorktreePlan, kind: 'current-checkout' }

  it('launches in the primary workspace of the project', async () => {
    const { client, sendRequest } = fakeClient({
      'worktree.ps': catalog,
      'agent.launchReplay': launchReceipt({
        delivery: 'submit',
        outcome: 'journaled',
        messageId: 'm1'
      })
    })
    const result = await run(client, checkoutPlan, { replay: true })
    expect(result).toEqual({ ok: true, worktreeId: 'web::/work/web', name: 'web' })
    expect(paramsOf(sendRequest, 'agent.launchReplay')).toMatchObject({
      agent: 'claude',
      target: { kind: 'existing', worktree: 'id:web::/work/web' },
      prompt: { text: 'fix the login bug', delivery: 'submit' },
      sessionOptions: { model: 'opus', accessMode: 'plan' }
    })
  })

  it('falls back to the derived checkout id when the catalog is unreadable', async () => {
    const { client, sendRequest } = fakeClient({
      'agent.launchReplay': launchReceipt({
        delivery: 'submit',
        outcome: 'journaled',
        messageId: 'm1'
      })
    })
    await run(client, checkoutPlan, { replay: true })
    expect(paramsOf(sendRequest, 'agent.launchReplay')).toMatchObject({
      target: { kind: 'existing', worktree: 'id:web::/work/web' }
    })
  })

  it('asks for an update when the host cannot replay a launch', async () => {
    const { client, sendRequest } = fakeClient({ 'worktree.ps': catalog })
    const result = await run(client, checkoutPlan, { replay: false })
    expect(result).toMatchObject({ ok: false })
    expect(sendRequest.mock.calls.some(([method]) => method === 'agent.launchReplay')).toBe(false)
  })

  it('reports a launch the host could not confirm', async () => {
    const { client } = fakeClient({
      'worktree.ps': catalog,
      'agent.launchReplay': refused('agent_session_operation_unknown', 'unknown')
    })
    expect(await run(client, checkoutPlan, { replay: true })).toMatchObject({ ok: false })
  })
})
