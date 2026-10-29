import { describe, expect, it, vi } from 'vitest'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import { markRpcDeliveryUnknown } from '../transport/rpc-delivery-ambiguity'
import {
  CREATE_SESSION_PROMPT_NOT_CONFIRMED_MESSAGE,
  launchCreateSession,
  type CreateSessionLaunchSetup
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
  support: { replay: boolean } | false,
  setup: CreateSessionLaunchSetup = { decision: 'inherit', notice: null },
  target: MobileWorkspaceRepo = repo
) {
  return launchCreateSession({
    client,
    hostId: 'host-1',
    repo: target,
    plan,
    setup,
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

  it('does not use a sibling row when the host omits the main flag', async () => {
    const siblings = ok({
      snapshotId: 's2',
      worktrees: [
        { worktreeId: 'web::/work/web-feature', repoId: 'web', path: '/work/web-feature' },
        { worktreeId: 'web::/work/web', repoId: 'web', path: '/work/web' }
      ]
    })
    const { client, sendRequest } = fakeClient({
      'worktree.ps': siblings,
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

  it('opens a folder in its own workspace, not a sibling folder workspace', async () => {
    const folder: MobileWorkspaceRepo = {
      id: 'notes',
      displayName: 'notes',
      path: '/work/notes',
      kind: 'folder'
    }
    const rows = ok({
      snapshotId: 's3',
      worktrees: [{ worktreeId: 'notes::/work/other', repoId: 'notes', path: '/work/other' }]
    })
    const { client, sendRequest } = fakeClient({
      'worktree.ps': rows,
      'agent.launchReplay': launchReceipt({
        delivery: 'submit',
        outcome: 'journaled',
        messageId: 'm1'
      })
    })
    await run(client, checkoutPlan, { replay: true }, undefined, folder)
    expect(paramsOf(sendRequest, 'agent.launchReplay')).toMatchObject({
      target: { kind: 'existing', worktree: 'id:notes::/work/notes' }
    })
  })

  it('lands on the tab of the chat the host built', async () => {
    const tabId = '4f7c2d1e-9a3b-4c5d-8e6f-0a1b2c3d4e5f'
    const { client } = fakeClient({
      'worktree.ps': catalog,
      'agent.launchReplay': ok({
        worktreeId: 'web::/work/web',
        outcome: { kind: 'structured', sessionId: 'claude-1', handle: 'h', tabId },
        receipt: RECEIPT,
        prompt: { delivery: 'submit', outcome: 'journaled', messageId: 'm1' }
      })
    })
    const result = await run(client, checkoutPlan, { replay: true })
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.paneKey?.startsWith(`${tabId}:`)).toBe(true)
  })

  it('lands on the terminal pane the host reports', async () => {
    const paneKey = '4f7c2d1e-9a3b-4c5d-8e6f-0a1b2c3d4e5f:5a6b7c8d-1e2f-4a3b-9c4d-5e6f7a8b9c0d'
    const { client } = fakeClient({
      'worktree.ps': catalog,
      'agent.launchReplay': ok({
        worktreeId: 'web::/work/web',
        outcome: { kind: 'terminal', handle: 'term-1', paneKey },
        receipt: RECEIPT,
        prompt: { delivery: 'submit', outcome: 'handed-to-terminal' }
      })
    })
    const result = await run(client, checkoutPlan, { replay: true })
    expect(result.ok && result.paneKey).toBe(paneKey)
  })

  it('names itself as the mobile launch source', async () => {
    const { client, sendRequest } = fakeClient({
      'worktree.ps': catalog,
      'agent.launchReplay': launchReceipt({
        delivery: 'submit',
        outcome: 'journaled',
        messageId: 'm'
      })
    })
    await run(client, checkoutPlan, { replay: true })
    expect(paramsOf(sendRequest, 'agent.launchReplay')).toMatchObject({ launchSource: 'mobile' })
  })
})

describe('launchCreateSession setup script', () => {
  const receipt = launchReceipt({ delivery: 'submit', outcome: 'journaled', messageId: 'm' })

  function createParams(sendRequest: ReturnType<typeof fakeClient>['sendRequest']) {
    const params = paramsOf(sendRequest, 'agent.launch')
    return params && typeof params === 'object' && 'target' in params ? params.target : undefined
  }

  it('sends the decision the project allows, never a blind default', async () => {
    const { client, sendRequest } = fakeClient({ 'agent.launch': receipt })
    await run(client, newWorktreePlan, { replay: false }, { decision: 'skip', notice: null })
    expect(createParams(sendRequest)).toMatchObject({ create: { setupDecision: 'skip' } })
  })

  it('says on landing that an untrusted script was skipped', async () => {
    const { client } = fakeClient({ 'agent.launch': receipt })
    const result = await run(
      client,
      newWorktreePlan,
      { replay: false },
      { decision: 'skip', notice: 'The setup script is not trusted yet, so it will be skipped.' }
    )
    expect(result).toMatchObject({
      ok: true,
      warning: 'The setup script is not trusted yet, so it will be skipped.'
    })
  })
})

describe('launchCreateSession failure handling', () => {
  it('never falls back to a bare worktree create when the host refuses agent.launch', async () => {
    const { client, sendRequest } = fakeClient({})
    const result = await run(client, newWorktreePlan, { replay: false })
    expect(result).toEqual({
      ok: false,
      message: 'Update MassOrca on your computer to start an agent from your phone.'
    })
    expect(sendRequest.mock.calls.some(([method]) => method === 'worktree.create')).toBe(false)
  })

  it('asks for a check, not a retry, when the create may have reached the host', async () => {
    const { client, sendRequest } = fakeClient({})
    sendRequest.mockImplementation(async (method: string) => {
      if (method === 'agent.launch') {
        throw markRpcDeliveryUnknown(new Error('Connection interrupted'))
      }
      return refused('method_not_found', method)
    })
    const result = await run(client, newWorktreePlan, { replay: false })
    expect(result).toEqual({
      ok: false,
      message: "Couldn't confirm the agent started. Check the workspace before trying again."
    })
    expect(sendRequest.mock.calls.filter(([method]) => method === 'agent.launch')).toHaveLength(1)
  })
})

describe('launchCreateSession chat preference and surface', () => {
  const receipt = launchReceipt({ delivery: 'submit', outcome: 'journaled', messageId: 'm' })
  const terminalReceipt = (detail: string) =>
    ok({
      worktreeId: 'wt-new',
      outcome: { kind: 'terminal', handle: 'term-1' },
      receipt: { mode: 'terminal', preferred: 'terminal', reason: 'wsl_execution_runtime', detail },
      prompt: { delivery: 'submit', outcome: 'handed-to-terminal' }
    })

  it('asks for a chat on a new worktree and on the current checkout', async () => {
    const created = fakeClient({ 'agent.launch': receipt })
    await run(created.client, newWorktreePlan, { replay: false })
    expect(paramsOf(created.sendRequest, 'agent.launch')).toMatchObject({ preferredMode: 'chat' })
    const checkout = fakeClient({ 'worktree.ps': catalog, 'agent.launchReplay': receipt })
    await run(checkout.client, { ...newWorktreePlan, kind: 'current-checkout' }, { replay: true })
    expect(paramsOf(checkout.sendRequest, 'agent.launchReplay')).toMatchObject({
      preferredMode: 'chat'
    })
  })

  it('says so on landing when the host still built a terminal', async () => {
    const { client } = fakeClient({
      'agent.launch': terminalReceipt(
        'This launch asked for a structured chat session, but this workspace runs under WSL; started a terminal agent instead.'
      )
    })
    const result = await run(client, newWorktreePlan, { replay: false })
    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.warning).toMatch(/Opened as a terminal agent, not a chat\./)
    expect(result.ok && result.warning).toMatch(/runs under WSL/)
  })

  it('says so on the current checkout too', async () => {
    const { client } = fakeClient({
      'worktree.ps': catalog,
      'agent.launchReplay': terminalReceipt(
        'Started a terminal agent, the default for new agent tabs in your settings.'
      )
    })
    const result = await run(
      client,
      { ...newWorktreePlan, kind: 'current-checkout' },
      { replay: true }
    )
    expect(result.ok && result.warning).toMatch(/not a chat/)
  })

  it('stays quiet when the host built the chat', async () => {
    const { client } = fakeClient({ 'agent.launch': receipt })
    const result = await run(client, newWorktreePlan, { replay: false })
    expect(result).not.toHaveProperty('warning')
  })
})

describe('launchCreateSession base branch', () => {
  const receipt = launchReceipt({ delivery: 'submit', outcome: 'journaled', messageId: 'm' })

  function createOf(sendRequest: ReturnType<typeof fakeClient>['sendRequest']) {
    const params = paramsOf(sendRequest, 'agent.launch')
    return params && typeof params === 'object' && 'target' in params ? params.target : undefined
  }

  it('creates the worktree from the picked branch', async () => {
    const { client, sendRequest } = fakeClient({ 'agent.launch': receipt })
    await run(client, { ...newWorktreePlan, baseBranch: 'origin/release' }, { replay: false })
    expect(createOf(sendRequest)).toMatchObject({ create: { baseBranch: 'origin/release' } })
  })

  it('sends no base when none was picked, so the host default applies', async () => {
    const { client, sendRequest } = fakeClient({ 'agent.launch': receipt })
    await run(client, newWorktreePlan, { replay: false })
    expect(createOf(sendRequest)).toMatchObject({ create: { repo: 'id:web' } })
    expect(JSON.stringify(createOf(sendRequest))).not.toContain('baseBranch')
  })
})
