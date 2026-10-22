import type {
  AgentChildWorkEvidence,
  AgentChildWorkEvidenceHandle
} from '../../shared/agent-status-child-work-evidence'
import {
  AGENT_CHILD_WORK_LABEL_MAX_LENGTH,
  type AgentChildWorkOutcome
} from '../../shared/agent-status-child-work'
import type { AntigravityStreamStatus } from './antigravity-stream-json-protocol'
import type { AntigravityStreamTransportEvent } from './antigravity-stream-json-transport'

type StepUpdate = Extract<AntigravityStreamTransportEvent, { type: 'step_update' }>

/** agy launches a subagent through this tool; the tool step stays open while the subagent runs. */
const SUBAGENT_TOOL = 'invoke_subagent'

/** Child work for subagents agy launches, read from the same stream the timeline projector reads. */
export class AntigravitySubagentChildWork {
  /** Open subagents by the turn that launched them, then by tool step index. */
  private readonly openByTurn = new Map<string, Map<number, AgentChildWorkEvidenceHandle>>()

  constructor(private readonly now: () => number = Date.now) {}

  observe(event: AntigravityStreamTransportEvent): AgentChildWorkEvidence[] {
    if (event.type === 'step_update') {
      return this.observeStep(event)
    }
    if (event.type === 'result' && event.terminal) {
      return this.settleTurn(event.clientMessageId, event.result.status)
    }
    return []
  }

  /** The provider session ended, so children still open can no longer end on their own. */
  sessionEnded(): AgentChildWorkEvidence[] {
    if (this.openByTurn.size === 0) {
      return []
    }
    this.openByTurn.clear()
    return [{ type: 'session-ended', observedAt: this.now() }]
  }

  private observeStep({ step, clientMessageId }: StepUpdate): AgentChildWorkEvidence[] {
    if (step.step_type !== 'tool' || step.state === 'UNKNOWN') {
      return []
    }
    const info = isObject(step.tool_info) ? step.tool_info : null
    const name = step.tool_name ?? (typeof info?.name === 'string' ? info.name : undefined)
    if (name !== SUBAGENT_TOOL) {
      return []
    }
    const turn =
      this.openByTurn.get(clientMessageId) ?? new Map<number, AgentChildWorkEvidenceHandle>()
    if (step.state === 'ACTIVE') {
      const handle: AgentChildWorkEvidenceHandle = {
        idKind: 'task_id',
        id: `antigravity:${step.conversation_id}:subagent:${step.step_index}`
      }
      turn.set(step.step_index, handle)
      this.openByTurn.set(clientMessageId, turn)
      const parameters = readParameters(step.tool_info)
      const description = labelFrom(parameters.Role)
      const agentType = labelFrom(parameters.TypeName)
      return [
        {
          type: 'live',
          observedAt: this.now(),
          child: {
            handle,
            kind: 'agent',
            residency: 'background',
            state: 'working',
            ...(description ? { description } : {}),
            ...(agentType ? { agentType } : {}),
            stoppable: false
          }
        }
      ]
    }
    const handle = turn.get(step.step_index)
    if (!handle) {
      return []
    }
    turn.delete(step.step_index)
    if (turn.size === 0) {
      this.openByTurn.delete(clientMessageId)
    }
    const failed = step.state === 'FAILED' || (info?.error !== undefined && info.error !== null)
    return [
      {
        type: 'ended',
        observedAt: this.now(),
        handle,
        outcome: failed ? 'failed' : 'succeeded'
      }
    ]
  }

  /** The turn's end settles its open subagents: agy never reports them finished, so unknown. */
  private settleTurn(
    clientMessageId: string,
    status: AntigravityStreamStatus
  ): AgentChildWorkEvidence[] {
    const turn = this.openByTurn.get(clientMessageId)
    if (!turn) {
      return []
    }
    this.openByTurn.delete(clientMessageId)
    const outcome: AgentChildWorkOutcome =
      status === 'CANCELED' || status === 'INTERRUPTED' ? 'cancelled' : 'unknown'
    const observedAt = this.now()
    return [...turn.values()].map((handle): AgentChildWorkEvidence => ({
      type: 'ended',
      observedAt,
      handle,
      outcome
    }))
  }
}

function readParameters(toolInfo: unknown): Record<string, unknown> {
  if (!isObject(toolInfo) || !isObject(toolInfo.parameters)) {
    return {}
  }
  return toolInfo.parameters
}

function labelFrom(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const label = value.replace(/\s+/g, ' ').trim().slice(0, AGENT_CHILD_WORK_LABEL_MAX_LENGTH)
  return label === '' ? undefined : label
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
