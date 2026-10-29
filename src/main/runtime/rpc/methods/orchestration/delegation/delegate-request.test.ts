import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY,
  ORCHESTRATION_RUNTIME_CAPABILITIES
} from '../../../../../../shared/orchestration-runtime-capabilities'
import { RUNTIME_CAPABILITIES } from '../../../../../../shared/protocol-version'
import { isOrchestrationMutation } from '../../../../../../shared/orchestration-rpc-contract'
import { RPC_PARAMS_BY_METHOD } from '../../../../../../shared/rpc-contract/rpc-params-catalog.generated'
import { eraseRpcMethods, type RpcContext } from '../../../core'
import { ORCHESTRATION_DELEGATION_METHODS } from './delegate-request'

const request = vi.fn()
const ensureStructuredAgentSessionHost = vi.fn(async () => undefined)

vi.mock('../../../../../delegated-session/delegation-runtime', () => ({
  getDelegationRequestService: () => ({ request })
}))

const [method] = eraseRpcMethods(ORCHESTRATION_DELEGATION_METHODS)

if (!method) {
  throw new Error('orchestration.delegateRequest is not registered')
}

const CALLER = Object.freeze({
  sessionId: 'session_parent_01',
  orcaSessionId: 'session_parent_01',
  workspaceId: 'repo1::/work/app',
  address: 'orca_session_id:session_parent_01',
  terminalHandle: null,
  paneKey: null
})

function callAs(orchestrationCaller: unknown, params: Record<string, unknown>) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler reads only the runtime's host starter and the resolved caller.
  const ctx = { runtime: { ensureStructuredAgentSessionHost }, orchestrationCaller } as never
  return method!.handler(method!.params!.parse(params), ctx as RpcContext)
}

const call = (params: Record<string, unknown>) => callAs(CALLER, params)

describe('orchestration.delegateRequest', () => {
  beforeEach(() => {
    request.mockReset()
    request.mockResolvedValue({
      requestId: 'deleg_aaaaaaaaaaaa',
      status: 'awaiting_choice',
      questionItemId: 'orca:delegation%3Adeleg_aaaaaaaaaaaa'
    })
  })

  it('files the request for the chat that called, and returns what the card is', async () => {
    const result = await call({
      summary: 'Read only audit of the parser',
      prompt: 'List the unsafe casts.',
      title: 'Parser audit',
      writes: true
    })

    expect(ensureStructuredAgentSessionHost).toHaveBeenCalled()
    expect(request).toHaveBeenCalledWith({
      parentSessionId: 'session_parent_01',
      summary: 'Read only audit of the parser',
      prompt: 'List the unsafe casts.',
      title: 'Parser audit',
      writes: true
    })
    expect(result).toMatchObject({ requestId: 'deleg_aaaaaaaaaaaa', status: 'awaiting_choice' })
  })

  it('treats a child that does not say it writes as read-only, and a title as optional', async () => {
    await call({ summary: 's', prompt: 'p' })

    expect(request).toHaveBeenCalledWith({
      parentSessionId: 'session_parent_01',
      summary: 's',
      prompt: 'p',
      writes: false
    })
  })

  it('refuses a caller that is not a chat, and files nothing', async () => {
    await expect(callAs(undefined, { summary: 's', prompt: 'p' })).rejects.toMatchObject({
      code: 'delegation_requires_chat',
      data: { effectsApplied: false }
    })
    expect(request).not.toHaveBeenCalled()
  })

  it('needs a summary and a prompt', () => {
    expect(() => method!.params!.parse({ prompt: 'p' })).toThrow()
    expect(() => method!.params!.parse({ summary: 's' })).toThrow()
  })

  it('is a mutation, so a retried call replays instead of posting a second card', () => {
    expect(isOrchestrationMutation('orchestration.delegateRequest', {})).toBe(true)
  })

  it('is in the generated params catalog with the schema the host parses by', () => {
    expect(RPC_PARAMS_BY_METHOD['orchestration.delegateRequest']).toBe(method!.params)
  })
})

describe('the delegation capability', () => {
  it('is advertised by the orchestration capabilities and so by the runtime', () => {
    expect(ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY).toBe('orchestration.delegation.v1')
    expect(ORCHESTRATION_RUNTIME_CAPABILITIES).toContain(
      ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY
    )
    expect(RUNTIME_CAPABILITIES).toContain(ORCHESTRATION_DELEGATION_RUNTIME_CAPABILITY)
  })
})
