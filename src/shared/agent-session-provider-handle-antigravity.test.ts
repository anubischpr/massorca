import { describe, expect, it } from 'vitest'
import {
  agentSessionProviderHandleFromWire,
  agentSessionWireProviderHandle,
  antigravityProviderHandle,
  decodePersistedAgentSessionProviderHandle,
  encodePersistedAgentSessionProviderHandle
} from './agent-session-provider-handle-encoding'
import { ProviderHandle } from './rpc-contract/structured-agent-session-params'

const CONVERSATION_ID = 'c47de08c-23c6-4c39-8c1f-3d449b9066ba'

describe('antigravity provider handle wire form', () => {
  it('round-trips a conversation handle through the wire kind without changing its identity', () => {
    const handle = antigravityProviderHandle(CONVERSATION_ID)
    const wire = agentSessionWireProviderHandle(handle)
    expect(wire).toEqual({ kind: 'antigravity', conversationId: CONVERSATION_ID })
    expect(wire && agentSessionProviderHandleFromWire(wire)).toEqual(handle)
  })

  it('keeps the persisted form neutral, so the stored shape is the one the record store reads', () => {
    const handle = antigravityProviderHandle(CONVERSATION_ID)
    const stored = encodePersistedAgentSessionProviderHandle(handle)
    expect(stored).toEqual({
      transport: 'antigravity-stream-json',
      agent: 'antigravity',
      nativeId: CONVERSATION_ID
    })
    expect(decodePersistedAgentSessionProviderHandle(stored)).toEqual(handle)
  })

  it('refuses to put an empty or padded conversation id on the wire', () => {
    expect(agentSessionWireProviderHandle(antigravityProviderHandle(''))).toBeNull()
    expect(agentSessionWireProviderHandle(antigravityProviderHandle(' padded '))).toBeNull()
  })

  it('accepts the antigravity kind in the rpc schema and rejects a padded id', () => {
    expect(
      ProviderHandle.safeParse({ kind: 'antigravity', conversationId: CONVERSATION_ID }).success
    ).toBe(true)
    expect(ProviderHandle.safeParse({ kind: 'antigravity', conversationId: '' }).success).toBe(
      false
    )
    expect(
      ProviderHandle.safeParse({
        kind: 'antigravity',
        conversationId: CONVERSATION_ID,
        extra: true
      }).success
    ).toBe(false)
  })

  it('keeps the claude and codex wire kinds exactly as before', () => {
    expect(ProviderHandle.safeParse({ kind: 'codex', threadId: 'thread-1' }).success).toBe(true)
    expect(
      ProviderHandle.safeParse({ kind: 'claude', sessionId: 's1', leafUuid: null }).success
    ).toBe(true)
  })
})
