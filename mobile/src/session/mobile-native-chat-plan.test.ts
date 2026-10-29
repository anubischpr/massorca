import { describe, expect, it } from 'vitest'
import { CODEX_PLAN_UPDATED_FRAME_KIND } from '../../../src/shared/native-chat-provider-frame-summary'
import type { NativeChatBlock, NativeChatMessage } from '../../../src/shared/native-chat-types'
import { mobileNativeChatPlan, mobileNativeChatPlanProgress } from './mobile-native-chat-plan'

function message(id: string, blocks: NativeChatBlock[], agentId?: string): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks,
    timestamp: null,
    source: 'transcript',
    ...(agentId ? { agentId } : {})
  }
}

function call(
  name: string,
  input: unknown,
  callId: string,
  state: 'running' | 'completed' | 'failed' = 'completed'
): NativeChatBlock {
  return { type: 'tool-call', name, input, callId, state }
}

function todoWrite(callId: string, todos: unknown[]): NativeChatMessage {
  return message(callId, [call('TodoWrite', { todos }, callId)])
}

/** The result that answers a call, carrying the provider's own error flag. */
function result(callId: string, output: string, isError: boolean): NativeChatMessage {
  return message(`${callId}-result`, [{ type: 'tool-result', output, callId, isError }])
}

const todos = [
  { content: 'Read the spec', status: 'completed', activeForm: 'Reading the spec' },
  { content: 'Write the code', status: 'in_progress', activeForm: 'Writing the code' },
  { content: 'Run the tests', status: 'pending', activeForm: 'Running the tests' }
]

describe('mobileNativeChatPlan', () => {
  it('is null when the transcript holds no plan', () => {
    expect(mobileNativeChatPlan([message('a', [{ type: 'text', text: 'hello' }])])).toBeNull()
  })

  it('reads a TodoWrite snapshot as the plan, keeping each step status', () => {
    const plan = mobileNativeChatPlan([todoWrite('t1', todos)])
    expect(plan?.tasks).toEqual([
      { content: 'Read the spec', status: 'completed', activeForm: 'Reading the spec' },
      { content: 'Write the code', status: 'in_progress', activeForm: 'Writing the code' },
      { content: 'Run the tests', status: 'pending', activeForm: 'Running the tests' }
    ])
  })

  it('lets the latest update replace the earlier plan and keeps its explanation', () => {
    const plan = mobileNativeChatPlan([
      todoWrite('t1', todos),
      message('p2', [
        call(
          'update_plan',
          { explanation: 'Narrowed scope', plan: [{ step: 'Ship it', status: 'inProgress' }] },
          'p2'
        )
      ])
    ])
    expect(plan).toEqual({
      tasks: [{ content: 'Ship it', status: 'in_progress' }],
      explanation: 'Narrowed scope'
    })
  })

  it('never lets a failed call replace the plan', () => {
    const plan = mobileNativeChatPlan([
      todoWrite('t1', todos),
      message('t2', [
        call('TodoWrite', { todos: [{ content: 'Oops', status: 'pending' }] }, 't2', 'failed')
      ])
    ])
    expect(plan?.tasks.map((task) => task.content)).toEqual([
      'Read the spec',
      'Write the code',
      'Run the tests'
    ])
  })

  it('ignores plan calls made by a subagent', () => {
    expect(
      mobileNativeChatPlan([
        message(
          'sub',
          [call('TodoWrite', { todos: [{ content: 'Child step', status: 'pending' }] }, 's1')],
          'agent-1'
        )
      ])
    ).toBeNull()
  })

  it('builds the list from Claude TaskCreate calls', () => {
    const plan = mobileNativeChatPlan([
      message('c1', [call('TaskCreate', { subject: 'First step' }, 'c1')]),
      message('c2', [call('TaskCreate', { subject: 'Second step' }, 'c2')])
    ])
    expect(plan?.tasks.map((task) => task.content)).toEqual(['First step', 'Second step'])
  })

  it('reads a Codex plan notification carried as a provider frame', () => {
    const plan = mobileNativeChatPlan([
      {
        id: 'codex-plan',
        role: 'system',
        timestamp: 0,
        source: 'transcript',
        blocks: [
          {
            type: 'text',
            text: 'codex · plan',
            providerFrame: {
              provider: 'codex',
              kind: CODEX_PLAN_UPDATED_FRAME_KIND,
              payload: {
                head: JSON.stringify({ plan: [{ step: 'Port parser', status: 'completed' }] }),
                byteLength: 2,
                digest: 'digest',
                truncated: false
              }
            }
          }
        ]
      }
    ])
    expect(plan?.tasks).toEqual([{ content: 'Port parser', status: 'completed' }])
  })

  it('counts completed steps against all steps', () => {
    const plan = mobileNativeChatPlan([todoWrite('t1', todos)])
    expect(plan && mobileNativeChatPlanProgress(plan)).toEqual({ done: 1, total: 3 })
  })

  it('never lets a snapshot whose result errored replace the plan', () => {
    const plan = mobileNativeChatPlan([
      todoWrite('t1', todos),
      message('t2', [call('TodoWrite', { todos: [{ content: 'Oops', status: 'pending' }] }, 't2')]),
      result('t2', 'Todo list rejected', true)
    ])
    expect(plan?.tasks.map((task) => task.content)).toEqual([
      'Read the spec',
      'Write the code',
      'Run the tests'
    ])
  })

  it('lists nothing for a TaskCreate whose result errored', () => {
    expect(
      mobileNativeChatPlan([
        message('c1', [call('TaskCreate', { subject: 'Rejected step' }, 'c1')]),
        result('c1', 'Invalid task subject', true)
      ])
    ).toBeNull()
  })

  it('lists a TaskCreate still in flight as pending, with no result to finish it', () => {
    const plan = mobileNativeChatPlan([
      message('c1', [call('TaskCreate', { subject: 'Still running' }, 'c1', 'running')])
    ])
    expect(plan?.tasks).toEqual([{ content: 'Still running', status: 'pending' }])
  })

  it('applies a completed TaskUpdate to the task its create named', () => {
    const plan = mobileNativeChatPlan([
      message('c1', [call('TaskCreate', { subject: 'Ship it' }, 'c1')]),
      result('c1', 'Task #4 created successfully: Ship it', false),
      message('u1', [call('TaskUpdate', { taskId: '4', status: 'completed' }, 'u1')]),
      result('u1', 'Updated task #4 status', false)
    ])
    expect(plan?.tasks).toEqual([{ content: 'Ship it', status: 'completed' }])
  })

  it('keeps a task at its last status when the update that would change it errored', () => {
    const plan = mobileNativeChatPlan([
      message('c1', [call('TaskCreate', { subject: 'Ship it' }, 'c1')]),
      result('c1', 'Task #4 created successfully: Ship it', false),
      message('u1', [call('TaskUpdate', { taskId: '4', status: 'completed' }, 'u1')]),
      result('u1', 'Task not found', true)
    ])
    expect(plan?.tasks).toEqual([{ content: 'Ship it', status: 'pending' }])
  })
})
