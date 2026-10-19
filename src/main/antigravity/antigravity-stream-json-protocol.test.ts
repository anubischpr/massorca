import { describe, expect, it } from 'vitest'
import {
  AntigravityStreamProtocolError,
  AntigravityStreamStepFrameError,
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
    [{ conversation_id: 'conv-1', step_index: 1, state: 'DONE', step_type: '' }],
    [{ conversation_id: 'conv-1', step_index: 1, state: 'DONE' }],
    [null]
  ])('rejects step frames missing a required field: %o', (stepUpdate) => {
    expect(() =>
      parseAntigravityStreamRecord({ event: 'step_update', step_update: stepUpdate })
    ).toThrow(AntigravityStreamStepFrameError)
  })

  it('maps any step state name onto the step lifecycle without rejecting the frame', () => {
    const stateOf = (state: unknown) =>
      parseAntigravityStreamRecord({
        event: 'step_update',
        step_update: { conversation_id: 'conv-1', step_index: 1, state, step_type: 'tool' }
      })
    expect(stateOf('ACTIVE')).toMatchObject({ step_update: { state: 'ACTIVE' } })
    expect(stateOf('WAITING')).toMatchObject({ step_update: { state: 'ACTIVE' } })
    expect(stateOf('COMPLETED')).toMatchObject({ step_update: { state: 'DONE' } })
    expect(stateOf('ERROR')).toMatchObject({ step_update: { state: 'FAILED' } })
    expect(stateOf('canceled')).toMatchObject({ step_update: { state: 'FAILED' } })
    expect(stateOf('STEP_STATUS_FAILED')).toMatchObject({ step_update: { state: 'FAILED' } })
    expect(stateOf('SOMETHING_NEW')).toMatchObject({ step_update: { state: 'UNKNOWN' } })
    expect(stateOf(7)).toMatchObject({ step_update: { state: 'UNKNOWN' } })
    expect(stateOf(undefined)).toMatchObject({ step_update: { state: 'UNKNOWN' } })
  })

  it('parses a failed view_file step whose optional fields are null', () => {
    expect(
      parseAntigravityStreamRecord({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 4,
          state: 'ERROR',
          step_type: 'tool',
          tool_name: null,
          text_delta: null,
          duration_seconds: null,
          usage: { input_tokens: null, total_tokens: 8 },
          tool_info: { name: 'view_file', error: 'no such file or directory' }
        }
      })
    ).toEqual({
      event: 'step_update',
      step_update: {
        conversation_id: 'conv-1',
        step_index: 4,
        state: 'FAILED',
        step_type: 'tool',
        tool_info: { name: 'view_file', error: 'no such file or directory' },
        usage: { total_tokens: 8 }
      }
    })
  })

  it('names the failing field and the frame shape without copying any values', () => {
    let failure: unknown
    try {
      parseAntigravityStreamRecord({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 2,
          state: 'DONE',
          step_type: 'tool',
          text_delta: 42,
          tool_info: { output: 'private file contents' }
        }
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(AntigravityStreamStepFrameError)
    expect(failure).toMatchObject({
      field: 'text_delta',
      fieldKinds: {
        conversation_id: 'string',
        step_index: 'number',
        state: 'string',
        step_type: 'string',
        text_delta: 'number',
        tool_info: 'object'
      }
    })
    expect(JSON.stringify(failure)).not.toContain('private file contents')
  })

  it('reports a malformed usage count by its nested field name', () => {
    expect(() =>
      parseAntigravityStreamRecord({
        event: 'step_update',
        step_update: {
          conversation_id: 'conv-1',
          step_index: 3,
          state: 'DONE',
          step_type: 'agent_response',
          usage: { input_tokens: 'many' }
        }
      })
    ).toThrow('Antigravity step_update has invalid fields: usage.input_tokens')
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
