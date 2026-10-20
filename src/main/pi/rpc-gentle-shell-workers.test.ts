import { afterEach, describe, expect, it } from 'vitest'
import {
  closeGentleShellTurnRigs,
  openGentleShellTurnRig,
  type GentleShellTurnRig
} from './rpc-gentle-shell-test-support'

afterEach(closeGentleShellTurnRigs)

const agents = (taskId: string, status: string, mode?: string) => ({
  gentleAgents: { taskId, agent: 'explore', status, ...(mode ? { mode } : {}) }
})

function runWorker(h: GentleShellTurnRig, callId: string, label = 'map auth') {
  h.turns.receive({
    type: 'tool_execution_start',
    toolCallId: callId,
    toolName: 'subagent_run',
    args: { agent: 'explore', task: 'Explore how auth works', label }
  })
}

function runResult(h: GentleShellTurnRig, callId: string, text: string, details: unknown) {
  h.turns.receive({
    type: 'tool_execution_end',
    toolCallId: callId,
    toolName: 'subagent_run',
    isError: false,
    result: { content: [{ type: 'text', text }], details }
  })
}

const completion = (taskId: string, status: string, content: string) => ({
  type: 'message_end',
  message: {
    role: 'custom',
    customType: 'gentle-agents.result',
    content,
    display: true,
    details: agents(taskId, status, 'background')
  }
})

describe('Gentle Shell workers', () => {
  it('lists a running worker call as a live foreground subagent, then settles it from its result', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    runWorker(h, 'c1')
    await h.flush()
    expect(h.evidence).toEqual([
      {
        type: 'live',
        observedAt: expect.any(Number),
        child: {
          handle: { idKind: 'task_id', id: 'gentle-worker:gen-1:c1', runId: 'c1' },
          kind: 'agent',
          residency: 'foreground',
          state: 'working',
          name: 'map auth',
          agentType: 'explore',
          description: 'Explore how auth works',
          stoppable: false
        }
      }
    ])
    runResult(
      h,
      'c1',
      'Subagent explore (task t_1, "map auth") finished.\n\nAuth lives in lib/auth.ts',
      agents('t_1', 'completed', 'task')
    )
    await h.flush()
    expect(h.evidence.at(-1)).toEqual({
      type: 'ended',
      observedAt: expect.any(Number),
      handle: { idKind: 'task_id', id: 'gentle-worker:gen-1:c1', runId: 'c1' },
      outcome: 'succeeded',
      lastMessage: 'Auth lives in lib/auth.ts'
    })
  })

  it('keeps a background worker live until its completion message', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    runWorker(h, 'c1')
    runResult(h, 'c1', 'Started explore in the background as task t_1.', agents('t_1', 'running', 'background'))
    await h.flush()
    const live = h.evidence.flatMap((edge) => (edge.type === 'live' ? [edge] : []))
    expect(live.at(-1)?.child).toMatchObject({ residency: 'background', state: 'working' })
    expect(h.evidence.some((edge) => edge.type === 'ended')).toBe(false)
    h.turns.receive(
      completion('t_1', 'failed', 'Subagent explore (task t_1, "map auth") failed.\n\nrepo not found')
    )
    await h.flush()
    expect(h.evidence.at(-1)).toMatchObject({
      type: 'ended',
      handle: { id: 'gentle-worker:gen-1:c1' },
      outcome: 'failed',
      lastMessage: 'repo not found'
    })
  })

  it('settles a background worker as cancelled when subagent_cancel succeeds', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    runWorker(h, 'c1')
    runResult(h, 'c1', 'Started.', agents('t_1', 'queued', 'background'))
    h.turns.receive({
      type: 'tool_execution_start',
      toolCallId: 'c2',
      toolName: 'subagent_cancel',
      args: { task_id: 't_1' }
    })
    h.turns.receive({
      type: 'tool_execution_end',
      toolCallId: 'c2',
      toolName: 'subagent_cancel',
      isError: false,
      result: { content: [{ type: 'text', text: 'Cancelled task t_1.' }] }
    })
    await h.flush()
    expect(h.evidence.at(-1)).toMatchObject({ type: 'ended', outcome: 'cancelled' })
  })

  it('settles a failed run call and ignores a completion for a worker it never saw', async () => {
    const h = await openGentleShellTurnRig()
    await h.openTurn()
    runWorker(h, 'c1')
    h.turns.receive({
      type: 'tool_execution_end',
      toolCallId: 'c1',
      toolName: 'subagent_run',
      isError: true,
      result: { content: [{ type: 'text', text: 'Error\n\nunknown agent' }] }
    })
    h.turns.receive(completion('t_9', 'completed', 'Subagent x finished.\n\nok'))
    await h.flush()
    const ended = h.evidence.filter((edge) => edge.type === 'ended')
    expect(ended).toEqual([
      expect.objectContaining({ outcome: 'failed', lastMessage: 'unknown agent' })
    ])
  })
})
