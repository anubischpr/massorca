import { describe, expect, it } from 'vitest'
import {
  AntigravityStreamProtocolError,
  isAntigravityTerminalStatus,
  parseAntigravityStreamRecord
} from './antigravity-stream-json-protocol'

describe('Antigravity stream-json protocol parser', () => {
  it('parses initialization only with a conversation identity', () => {
    expect(parseAntigravityStreamRecord({ event: 'init', conversation_id: 'conv-1' })).toEqual({
      event: 'init',
      conversation_id: 'conv-1'
    })
    expect(() => parseAntigravityStreamRecord({ event: 'init', conversation_id: '' })).toThrow(
      AntigravityStreamProtocolError
    )
  })

  it('validates step fields while preserving tool information and usage', () => {
    expect(
      parseAntigravityStreamRecord({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 2,
          state: 'ACTIVE',
          step_type: 'tool',
          tool_info: { name: 'run_command', parameters: { command: 'echo' } },
          usage: { input_tokens: 5, total_tokens: 8 }
        }
      })
    ).toEqual({
      event: 'step_update',
      step_update: {
        conversation_id: 'conv-1',
        step_index: 2,
        state: 'ACTIVE',
        step_type: 'tool',
        tool_info: { name: 'run_command', parameters: { command: 'echo' } },
        usage: { input_tokens: 5, total_tokens: 8 }
      }
    })
  })

  it.each([
    [{ conversation_id: '', step_index: 0, state: 'DONE', step_type: 'tool' }],
    [{ conversation_id: 'conv-1', step_index: -1, state: 'DONE', step_type: 'tool' }],
    [{ conversation_id: 'conv-1', step_index: 1.5, state: 'DONE', step_type: 'tool' }],
    [{ conversation_id: 'conv-1', step_index: 1, state: 'WAITING', step_type: 'tool' }],
    [{ conversation_id: 'conv-1', step_index: 1, state: 'DONE', step_type: '' }]
  ])('rejects invalid step fields: %o', (stepUpdate) => {
    expect(() =>
      parseAntigravityStreamRecord({ event: 'step_update', step_update: stepUpdate })
    ).toThrow(AntigravityStreamProtocolError)
  })

  it('parses terminal and nonterminal result statuses without changing cumulative usage scope', () => {
    expect(
      parseAntigravityStreamRecord({
        event: 'result',
        result: {
          conversation_id: 'conv-1',
          status: 'SUCCESS',
          response: 'answer',
          num_turns: 2,
          duration_seconds: 1.25,
          usage: { input_tokens: 10, output_tokens: 4 }
        }
      })
    ).toEqual({
      event: 'result',
      result: {
        conversation_id: 'conv-1',
        status: 'SUCCESS',
        response: 'answer',
        num_turns: 2,
        duration_seconds: 1.25,
        usage: { input_tokens: 10, output_tokens: 4 }
      }
    })
    expect(isAntigravityTerminalStatus('SUCCESS')).toBe(true)
    expect(isAntigravityTerminalStatus('WAITING')).toBe(false)
    expect(isAntigravityTerminalStatus('RUNNING')).toBe(false)
  })

  it('rejects unsupported status names, incomplete results, and invalid cumulative usage', () => {
    const validResult = {
      conversation_id: 'conv-1',
      status: 'SUCCESS',
      response: 'answer',
      num_turns: 1
    }
    expect(() =>
      parseAntigravityStreamRecord({
        event: 'result',
        result: { ...validResult, status: 'UNKNOWN' }
      })
    ).toThrow(AntigravityStreamProtocolError)
    expect(() =>
      parseAntigravityStreamRecord({
        event: 'result',
        result: { ...validResult, conversation_id: '' }
      })
    ).toThrow('Antigravity result has invalid fields')
    expect(() =>
      parseAntigravityStreamRecord({
        event: 'result',
        result: { ...validResult, usage: { input_tokens: -1 } }
      })
    ).toThrow('usage.input_tokens must be non-negative')
    expect(() => parseAntigravityStreamRecord({ event: 'result', result: {} })).toThrow(
      'Antigravity result has invalid fields'
    )
  })
})
