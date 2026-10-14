import { describe, expect, it } from 'vitest'
import { AntigravityStreamEventProjector } from './antigravity-stream-json-events'
import type { AntigravityStreamTransportEvent } from './antigravity-stream-json-transport'
import type { AntigravityStreamStatus } from './antigravity-stream-json-protocol'

type StepEvent = Extract<AntigravityStreamTransportEvent, { type: 'step_update' }>
type ResultEvent = Extract<AntigravityStreamTransportEvent, { type: 'result' }>

const initialized: AntigravityStreamTransportEvent = {
  type: 'initialized',
  conversationId: 'conv-1'
}

function input(clientMessageId = 'send-1'): StepEvent {
  return {
    type: 'step_update',
    clientMessageId,
    requestedAt: 100,
    step: {
      conversation_id: 'conv-1',
      step_index: 0,
      state: 'DONE',
      step_type: 'user_input'
    }
  }
}

function result(
  status: AntigravityStreamStatus,
  response = '',
  overrides: Partial<ResultEvent['result']> = {}
): ResultEvent {
  return {
    type: 'result',
    clientMessageId: 'send-1',
    terminal: true,
    result: {
      conversation_id: 'conv-1',
      status,
      response,
      num_turns: 1,
      ...overrides
    }
  }
}

function projector(): AntigravityStreamEventProjector {
  const instance = new AntigravityStreamEventProjector(() => 250)
  instance.apply(initialized)
  return instance
}

describe('Antigravity stream-json event projection', () => {
  it('accepts echoed input once and closes streamed text with the cumulative final response', () => {
    const events = projector()
    expect(events.apply(input())).toEqual([
      { type: 'input.accepted', clientMessageId: 'send-1', requestedAt: 100 }
    ])
    expect(events.apply(input())).toEqual([])
    const delta = events.apply({
      type: 'step_update',
      clientMessageId: 'send-1',
      requestedAt: 100,
      step: {
        conversation_id: 'conv-1',
        step_index: 1,
        state: 'ACTIVE',
        step_type: 'agent_response',
        text_delta: 'partial'
      }
    })
    expect(delta).toEqual([
      { type: 'turn.open', at: 100 },
      {
        type: 'text.delta',
        item: { stream: 'antigravity:conv-1:response:send-1' },
        channel: 'assistant',
        text: 'partial'
      }
    ])
    const final = events.apply(result('SUCCESS', 'complete', { usage: { input_tokens: 500 } }))
    expect(final).toContainEqual({
      type: 'text.close',
      item: { stream: 'antigravity:conv-1:response:send-1' },
      text: 'complete'
    })
    expect(final.find((event) => event.type === 'provider.frame')).toMatchObject({
      frameKind: 'usage.cumulative',
      payload: { scope: 'conversation', usage: { input_tokens: 500 } }
    })
    expect(final.some((event) => event.type === 'context.usage')).toBe(false)
    expect(final.at(-1)).toMatchObject({ type: 'turn.end', state: 'completed', outcome: 'success' })
    expect(events.apply(result('SUCCESS', 'complete'))).toEqual([])
  })

  it('emits a complete assistant item when the result is the only response text', () => {
    const events = projector()
    events.apply(input())
    expect(events.apply(result('SUCCESS', 'answer'))).toEqual([
      { type: 'turn.open', at: 100 },
      {
        type: 'item.open',
        item: 'antigravity:conv-1:message:send-1',
        body: {
          kind: 'message',
          role: 'assistant',
          state: 'completed',
          blocks: [{ type: 'text', text: 'answer' }]
        }
      },
      {
        type: 'item.close',
        item: 'antigravity:conv-1:message:send-1',
        body: {
          kind: 'message',
          role: 'assistant',
          state: 'completed',
          blocks: [{ type: 'text', text: 'answer' }]
        }
      },
      { type: 'turn.end', at: 250, state: 'completed', outcome: 'success' }
    ])
  })

  it('projects tool lifecycle and tool errors without inventing approval events', () => {
    const events = projector()
    events.apply(input())
    const opened = events.apply({
      type: 'step_update',
      clientMessageId: 'send-1',
      requestedAt: 100,
      step: {
        conversation_id: 'conv-1',
        step_index: 1,
        state: 'ACTIVE',
        step_type: 'tool',
        tool_name: 'run_command',
        tool_info: { name: 'run_command', parameters: { command: 'echo' } }
      }
    })
    expect(opened).toContainEqual({
      type: 'item.open',
      item: 'antigravity:conv-1:tool:1',
      body: {
        kind: 'tool-call',
        name: 'run_command',
        callId: '1',
        input: { command: 'echo' },
        state: 'running'
      }
    })
    const closed = events.apply({
      type: 'step_update',
      clientMessageId: 'send-1',
      requestedAt: 100,
      step: {
        conversation_id: 'conv-1',
        step_index: 1,
        state: 'DONE',
        step_type: 'tool',
        tool_info: { name: 'run_command', error: { type: 'denied', message: 'not allowed' } }
      }
    })
    expect(closed).toContainEqual(
      expect.objectContaining({
        type: 'item.close',
        body: expect.objectContaining({ state: 'failed' })
      })
    )
    expect(closed).toContainEqual(
      expect.objectContaining({
        type: 'provider.frame',
        frameKind: 'tool.error'
      })
    )
    expect(closed.some((event) => event.type === 'request.open')).toBe(false)
  })

  it.each([
    ['CANCELED', 'interrupted', 'cancellation'],
    ['INTERRUPTED', 'interrupted', undefined],
    ['INVALID', 'completed', 'failure'],
    ['ERROR', 'completed', 'failure']
  ] as const)('maps %s to the existing terminal semantics', (status, state, outcome) => {
    const events = projector()
    events.apply(input())
    const terminal = events.apply(result(status, '', { error: 'provider detail' }))
    expect(terminal.at(-1)).toMatchObject({
      type: 'turn.end',
      state,
      ...(outcome ? { outcome } : {})
    })
    if (status === 'INVALID' || status === 'ERROR') {
      expect(terminal).toContainEqual(
        expect.objectContaining({
          type: 'provider.frame',
          frameKind: 'result.error',
          payload: expect.objectContaining({ status, error: 'provider detail' })
        })
      )
    }
  })

  it('ignores WAITING and RUNNING result envelopes and rejects mismatched identities', () => {
    const events = projector()
    events.apply(input())
    expect(events.apply({ ...result('WAITING'), terminal: false })).toEqual([])
    expect(events.apply({ ...result('RUNNING'), terminal: false })).toEqual([])
    expect(() =>
      events.apply({
        ...input(),
        step: { ...input().step, conversation_id: 'other' }
      })
    ).toThrow('mismatched conversation identity')
  })
})
