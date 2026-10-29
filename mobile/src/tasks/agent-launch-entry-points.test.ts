import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import { createBlankWorkspace } from './blank-workspace-create'

function ok(result: unknown): RpcResponse {
  return { id: '1', ok: true, result, _meta: { runtimeId: 'r' } }
}

const launched = ok({
  worktreeId: 'wt-new',
  outcome: { kind: 'structured', sessionId: 'claude-1', handle: 'h' },
  receipt: { mode: 'structured', preferred: 'structured', reason: 'user_default', detail: 'Chat.' }
})
const created = ok({ worktree: { id: 'wt-new', displayName: 'otter' } })

function fakeClient() {
  const sendRequest = vi.fn(async (method: string, _params?: unknown, _options?: unknown) => {
    return method === 'worktree.create' ? created : launched
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

const base = {
  repoId: 'repo-1',
  baseName: 'otter',
  nameWasGenerated: true,
  comment: undefined,
  setupDecision: 'skip' as const,
  worktreeCreateIdempotency: Promise.resolve(false as const)
}

function paramsOf(sendRequest: ReturnType<typeof fakeClient>['sendRequest'], method: string) {
  return sendRequest.mock.calls.find(([called]) => called === method)?.[1]
}

describe('the old Create worktree form', () => {
  it('asks for a chat when it starts an agent through agent.launch', async () => {
    const { client, sendRequest } = fakeClient()
    await createBlankWorkspace({
      ...base,
      client,
      createdWithAgentId: 'claude',
      agentLaunchSupported: { replay: false }
    })
    expect(paramsOf(sendRequest, 'agent.launch')).toMatchObject({
      agent: 'claude',
      preferredMode: 'chat'
    })
  })

  it('asks for a chat over agent.launchReplay on a host with the ledger', async () => {
    const { client, sendRequest } = fakeClient()
    await createBlankWorkspace({
      ...base,
      client,
      createdWithAgentId: 'codex',
      agentLaunchSupported: { replay: true }
    })
    expect(paramsOf(sendRequest, 'agent.launchReplay')).toMatchObject({
      agent: 'codex',
      preferredMode: 'chat'
    })
  })

  it('keeps an older host on worktree.create, which starts the agent its own way', async () => {
    const { client, sendRequest } = fakeClient()
    await createBlankWorkspace({
      ...base,
      client,
      createdWithAgentId: 'claude',
      agentLaunchSupported: false
    })
    expect(paramsOf(sendRequest, 'worktree.create')).toMatchObject({ startupAgent: 'claude' })
    expect(sendRequest.mock.calls.some(([method]) => method.startsWith('agent.launch'))).toBe(false)
  })
})

describe('the blank terminal', () => {
  it('never asks for a chat: it is a plain worktree create with no agent', async () => {
    const { client, sendRequest } = fakeClient()
    await createBlankWorkspace({
      ...base,
      client,
      createdWithAgentId: undefined,
      agentLaunchSupported: { replay: true }
    })
    expect(sendRequest.mock.calls.map(([method]) => method)).toEqual(['worktree.create'])
    expect(JSON.stringify(paramsOf(sendRequest, 'worktree.create'))).not.toContain('preferredMode')
  })
})
