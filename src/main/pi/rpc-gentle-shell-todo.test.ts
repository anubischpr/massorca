import { afterEach, describe, expect, it } from 'vitest'
import { normalizeNativeChatTaskList } from '../../shared/native-chat-task-list'
import { closeGentleShellTurnRigs, openGentleShellTurnRig } from './rpc-gentle-shell-test-support'

afterEach(closeGentleShellTurnRigs)

const todoResult = (tasks: unknown[]) => ({
  content: [{ type: 'text', text: 'Todo list written' }],
  details: { gentleTodo: { tasks, nextId: tasks.length + 1, updatedTurn: 1 } }
})

async function todoCall(h: Awaited<ReturnType<typeof openGentleShellTurnRig>>) {
  const rows = await h.rig.rows()
  return rows.flatMap(({ body }) =>
    body.kind === 'tool-call' && body.name === 'todo' ? [body] : []
  )[0]
}

describe('Gentle Shell todo list', () => {
  it('publishes the full snapshot the todo result holds, not just the action', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    h.turns.receive({
      type: 'tool_execution_start',
      toolCallId: 'c1',
      toolName: 'todo',
      args: { action: 'update', id: 2, status: 'done' }
    })
    h.turns.receive({
      type: 'tool_execution_end',
      toolCallId: 'c1',
      toolName: 'todo',
      isError: false,
      result: todoResult([
        { id: 1, title: 'Write the parser', status: 'done' },
        { id: 2, title: 'Add tests', status: 'in_progress', note: 'writing the RED test' },
        { id: 3, title: 'Wait for review', status: 'blocked', note: 'needs an admin' },
        { id: 4, title: 'Old idea', status: 'dropped' },
        { id: 5, title: 'Ship', status: 'pending' }
      ])
    })
    await h.flush()
    const call = await todoCall(h)
    expect(call?.state).toBe('completed')
    expect(normalizeNativeChatTaskList(call!.name, call!.input)).toEqual({
      tasks: [
        { content: 'Write the parser', status: 'completed' },
        { content: 'Add tests', status: 'in_progress', activeForm: 'writing the RED test' },
        { content: 'Wait for review', status: 'pending' },
        { content: 'Ship', status: 'pending' }
      ]
    })
  })

  it('reads an emptied list as no tasks, and no plan from a result that reported an error', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    h.turns.receive({
      type: 'tool_execution_end',
      toolCallId: 'c1',
      toolName: 'todo',
      isError: false,
      args: { action: 'clear' },
      result: todoResult([])
    })
    h.turns.receive({
      type: 'tool_execution_end',
      toolCallId: 'c2',
      toolName: 'todo',
      isError: false,
      args: { action: 'write', tasks: [{ title: 'Not yet reported' }] },
      result: {
        content: [{ type: 'text', text: 'Error: nope' }],
        details: { gentleTodo: { tasks: [] }, error: 'nope' }
      }
    })
    await h.flush()
    const calls = (await h.rig.rows()).flatMap(({ body }) =>
      body.kind === 'tool-call' && body.name === 'todo' ? [body] : []
    )
    expect(calls.map((call) => normalizeNativeChatTaskList(call.name, call.input))).toEqual([
      { tasks: [] },
      null
    ])
  })
})
