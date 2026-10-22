import { expect, it } from 'vitest'
import type { AntigravityStreamStatus } from './antigravity-stream-json-protocol'
import type { AntigravityStreamTransportEvent } from './antigravity-stream-json-transport'
import { AntigravitySubagentChildWork } from './antigravity-subagent-child-work'

const CONVERSATION = 'conversation-1'
const TURN = 'message-1'
const OBSERVED_AT = 1_000

type ToolState = 'ACTIVE' | 'DONE' | 'FAILED' | 'UNKNOWN'

function toolStep(
  stepIndex: number,
  state: ToolState,
  toolName: string | undefined,
  toolInfo?: unknown
): AntigravityStreamTransportEvent {
  return {
    type: 'step_update',
    clientMessageId: TURN,
    requestedAt: 1,
    step: {
      conversation_id: CONVERSATION,
      step_index: stepIndex,
      state,
      step_type: 'tool',
      ...(toolName === undefined ? {} : { tool_name: toolName }),
      ...(toolInfo === undefined ? {} : { tool_info: toolInfo })
    }
  }
}

/** The `invoke_subagent` input agy sends is only `Role` and `TypeName` (`parameters`). */
function invokeSubagent(stepIndex: number, state: ToolState = 'ACTIVE') {
  return toolStep(stepIndex, state, 'invoke_subagent', {
    parameters: { Role: 'research  worker ', TypeName: 'research' }
  })
}

function handleFor(stepIndex: number) {
  return { idKind: 'task_id', id: `antigravity:${CONVERSATION}:subagent:${stepIndex}` }
}

function turnResult(
  status: AntigravityStreamStatus = 'SUCCESS',
  clientMessageId = TURN,
  terminal = true
): AntigravityStreamTransportEvent {
  return {
    type: 'result',
    clientMessageId,
    terminal,
    result: { conversation_id: CONVERSATION, status, response: '', num_turns: 1 }
  }
}

it('opens a background agent child when agy starts an invoke_subagent tool step', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  expect(tracker.observe(invokeSubagent(137))).toEqual([
    {
      type: 'live',
      observedAt: OBSERVED_AT,
      child: {
        handle: handleFor(137),
        kind: 'agent',
        residency: 'background',
        state: 'working',
        description: 'research worker',
        agentType: 'research',
        stoppable: false
      }
    }
  ])
})

it('reads the tool name from tool_info when the step does not declare it', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  const [live] = tracker.observe(
    toolStep(4, 'ACTIVE', undefined, { name: 'invoke_subagent', parameters: { TypeName: 'x' } })
  )
  expect(live).toMatchObject({ type: 'live', child: { handle: handleFor(4), agentType: 'x' } })
  expect(live).not.toHaveProperty('child.description')
})

it('ignores other tools, unreadable states and steps that are not tools', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  expect(tracker.observe(toolStep(3, 'ACTIVE', 'read_file', { parameters: {} }))).toEqual([])
  expect(tracker.observe(invokeSubagent(4, 'UNKNOWN'))).toEqual([])
  expect(
    tracker.observe({
      type: 'step_update',
      clientMessageId: TURN,
      requestedAt: 1,
      step: {
        conversation_id: CONVERSATION,
        step_index: 5,
        state: 'ACTIVE',
        step_type: 'agent_response',
        text_delta: 'text'
      }
    })
  ).toEqual([])
  expect(tracker.observe(invokeSubagent(6, 'DONE'))).toEqual([])
})

it('ends a subagent as succeeded or failed when its tool step reports the end', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  tracker.observe(invokeSubagent(2))
  expect(tracker.observe(invokeSubagent(2, 'DONE'))).toEqual([
    { type: 'ended', observedAt: OBSERVED_AT, handle: handleFor(2), outcome: 'succeeded' }
  ])

  tracker.observe(invokeSubagent(3))
  expect(tracker.observe(invokeSubagent(3, 'FAILED'))).toEqual([
    { type: 'ended', observedAt: OBSERVED_AT, handle: handleFor(3), outcome: 'failed' }
  ])

  tracker.observe(invokeSubagent(7))
  expect(
    tracker.observe(toolStep(7, 'DONE', 'invoke_subagent', { parameters: {}, error: 'tool error' }))
  ).toEqual([{ type: 'ended', observedAt: OBSERVED_AT, handle: handleFor(7), outcome: 'failed' }])
})

it('settles subagents still open at the end of their turn as unknown', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  tracker.observe(invokeSubagent(137))
  tracker.observe(invokeSubagent(138))

  expect(tracker.observe(turnResult('SUCCESS'))).toEqual([
    { type: 'ended', observedAt: OBSERVED_AT, handle: handleFor(137), outcome: 'unknown' },
    { type: 'ended', observedAt: OBSERVED_AT, handle: handleFor(138), outcome: 'unknown' }
  ])
  expect(tracker.observe(turnResult('SUCCESS'))).toEqual([])
})

it('settles an interrupted turn as cancelled, not as unknown', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  tracker.observe(invokeSubagent(9))

  expect(tracker.observe(turnResult('INTERRUPTED'))).toEqual([
    { type: 'ended', observedAt: OBSERVED_AT, handle: handleFor(9), outcome: 'cancelled' }
  ])
})

it('keeps a subagent open while another turn or a non-terminal result arrives', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  tracker.observe(invokeSubagent(2))

  expect(tracker.observe(turnResult('SUCCESS', 'message-2'))).toEqual([])
  expect(tracker.observe(turnResult('WAITING', TURN, false))).toEqual([])
  expect(tracker.observe(invokeSubagent(2, 'DONE'))).toEqual([
    { type: 'ended', observedAt: OBSERVED_AT, handle: handleFor(2), outcome: 'succeeded' }
  ])
})

it('reports the session ending only while children are still open', () => {
  const tracker = new AntigravitySubagentChildWork(() => OBSERVED_AT)

  expect(tracker.sessionEnded()).toEqual([])

  tracker.observe(invokeSubagent(2))
  expect(tracker.sessionEnded()).toEqual([{ type: 'session-ended', observedAt: OBSERVED_AT }])
  expect(tracker.sessionEnded()).toEqual([])
})
