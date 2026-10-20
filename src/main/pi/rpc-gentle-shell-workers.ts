import { AGENT_CHILD_WORK_LAST_MESSAGE_MAX_LENGTH } from '../../shared/agent-status-child-work'
import type { AgentChildWorkOutcome } from '../../shared/agent-status-child-work'
import type { AgentChildWorkEvidence } from '../../shared/agent-status-child-work-evidence'
import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import { stripTerminalControl } from '../../shared/terminal-control-stripping'
import type { JsonlRpcRecord } from '../jsonl-rpc/peer'
import {
  GENTLE_WORKER_CANCEL_TOOL,
  GENTLE_WORKER_RESULT_TYPE,
  GENTLE_WORKER_RUN_TOOL,
  GENTLE_WORKER_STALE_NOTICE_TYPE,
  isFinishedGentleWorkerStatus,
  readGentleWorkerFacts,
  type GentleWorkerFacts,
  type GentleWorkerStatus
} from './gentle-shell-worker-details'
import { piRpcToolEventSchema, type PiRpcToolEvent } from './rpc-protocol'

// Gentle Shell workers (`subagent_run`) read as the subagents the chat lists. A worker is live from
// its `subagent_run` call until a finished status: the call's own result for a foreground task, or
// the later completion message for a background one. `subagent_cancel` also settles it.

const MAX_LIVE_WORKERS = 64
const MAX_PENDING_CALLS = 64

type LiveWorker = {
  handleId: string
  runId: string
  agent?: string
  name?: string
  task?: string
  taskId?: string
  background: boolean
}

export type WorkerEdge = (observedAt: number) => AgentChildWorkEvidence

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

/** The answer or error after the "Subagent … finished." header, newest part kept. */
function answerTail(content: string): string | undefined {
  const split = content.indexOf('\n\n')
  const body = stripTerminalControl(split === -1 ? '' : content.slice(split + 2)).trim()
  return body.slice(-AGENT_CHILD_WORK_LAST_MESSAGE_MAX_LENGTH).trim() || undefined
}

function toolText(result: unknown): string {
  const content = isRecord(result) && Array.isArray(result.content) ? result.content : []
  return content
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('\n')
}

function outcomeOf(status: GentleWorkerStatus): AgentChildWorkOutcome {
  if (status === 'completed') {
    return 'succeeded'
  }
  if (status === 'cancelled') {
    return 'cancelled'
  }
  return status === 'failed' || status === 'timed_out' ? 'failed' : 'unknown'
}

/** Decodes Gentle Shell's worker tool results and completions into child-work edges. */
export class PiRpcGentleWorkers {
  private readonly starting = new Map<string, LiveWorker>()
  private readonly cancels = new Map<string, string>()
  private readonly byTask = new Map<string, LiveWorker>()

  constructor(private readonly generation: string) {}

  /** The edges one received frame causes. */
  observeFrame(frame: JsonlRpcRecord): WorkerEdge[] {
    const tool = piRpcToolEventSchema.safeParse(frame)
    if (tool.success) {
      return this.observeTool(tool.data)
    }
    return frame.type === 'message_end' ? this.observeCompletion(frame.message) : []
  }

  /** The provider session is gone: nothing a worker was waiting on can arrive. */
  clear(): void {
    this.starting.clear()
    this.cancels.clear()
    this.byTask.clear()
  }

  private observeTool(event: PiRpcToolEvent): WorkerEdge[] {
    if (event.toolName === GENTLE_WORKER_RUN_TOOL) {
      if (event.type === 'tool_execution_start') {
        return this.start(event)
      }
      return event.type === 'tool_execution_end' ? this.runResult(event) : []
    }
    if (event.toolName !== GENTLE_WORKER_CANCEL_TOOL) {
      return []
    }
    if (event.type === 'tool_execution_start') {
      const taskId = isRecord(event.args) ? text(event.args.task_id) : undefined
      if (taskId && this.cancels.size < MAX_PENDING_CALLS) {
        this.cancels.set(event.toolCallId, taskId)
      }
      return []
    }
    if (event.type !== 'tool_execution_end') {
      return []
    }
    const taskId = this.cancels.get(event.toolCallId)
    this.cancels.delete(event.toolCallId)
    const worker = taskId ? this.byTask.get(taskId) : undefined
    return worker && event.isError !== true ? this.end(worker, 'cancelled') : []
  }

  private start(event: PiRpcToolEvent): WorkerEdge[] {
    if (this.starting.size >= MAX_PENDING_CALLS || this.byTask.size >= MAX_LIVE_WORKERS) {
      return []
    }
    const args = isRecord(event.args) ? event.args : {}
    const agent = text(args.agent)
    const name = text(args.label) ?? agent
    const task = text(args.task)
    const worker: LiveWorker = {
      handleId: `gentle-worker:${this.generation}:${event.toolCallId}`,
      runId: event.toolCallId,
      background: false,
      ...(agent ? { agent } : {}),
      ...(name ? { name } : {}),
      ...(task ? { task } : {})
    }
    this.starting.set(event.toolCallId, worker)
    return [(observedAt) => this.liveEdge(worker, observedAt)]
  }

  private runResult(event: PiRpcToolEvent): WorkerEdge[] {
    const worker = this.starting.get(event.toolCallId)
    this.starting.delete(event.toolCallId)
    if (!worker) {
      return []
    }
    const result = isRecord(event.result) ? event.result : undefined
    const facts = event.isError === true ? undefined : readGentleWorkerFacts(result?.details)
    const message = answerTail(toolText(result))
    if (!facts) {
      return this.end(worker, event.isError === true ? 'failed' : 'unknown', message)
    }
    if (isFinishedGentleWorkerStatus(facts.status)) {
      return this.end(worker, outcomeOf(facts.status), message)
    }
    this.track(worker, facts)
    return [(observedAt) => this.liveEdge(worker, observedAt)]
  }

  private track(worker: LiveWorker, facts: GentleWorkerFacts): void {
    worker.taskId = facts.taskId
    worker.background = facts.mode === 'background'
    this.byTask.set(facts.taskId, worker)
  }

  private observeCompletion(message: unknown): WorkerEdge[] {
    if (
      !isRecord(message) ||
      (message.customType !== GENTLE_WORKER_RESULT_TYPE &&
        message.customType !== GENTLE_WORKER_STALE_NOTICE_TYPE)
    ) {
      return []
    }
    const facts = readGentleWorkerFacts(message.details)
    const worker = facts && this.byTask.get(facts.taskId)
    if (!facts || !worker || !isFinishedGentleWorkerStatus(facts.status)) {
      return []
    }
    const content = message.customType === GENTLE_WORKER_RESULT_TYPE ? message.content : undefined
    return this.end(worker, outcomeOf(facts.status), answerTail(text(content) ?? ''))
  }

  private end(
    worker: LiveWorker,
    outcome: AgentChildWorkOutcome,
    lastMessage?: string
  ): WorkerEdge[] {
    this.starting.delete(worker.runId)
    if (worker.taskId) {
      this.byTask.delete(worker.taskId)
    }
    return [
      (observedAt) => ({
        type: 'ended',
        observedAt,
        handle: { idKind: 'task_id', id: worker.handleId, runId: worker.runId },
        outcome,
        ...(lastMessage ? { lastMessage } : {})
      })
    ]
  }

  private liveEdge(worker: LiveWorker, observedAt: number): AgentChildWorkEvidence {
    return {
      type: 'live',
      observedAt,
      child: {
        handle: { idKind: 'task_id', id: worker.handleId, runId: worker.runId },
        kind: 'agent',
        residency: worker.background ? 'background' : 'foreground',
        // A worker `waiting` asks its parent agent, not the user, so it never reads as `waiting`.
        state: 'working',
        ...(worker.name ? { name: worker.name } : {}),
        ...(worker.agent ? { agentType: worker.agent } : {}),
        ...(worker.task ? { description: worker.task } : {}),
        // Gentle Shell cancels a worker only through its model tool (`subagent_cancel`).
        stoppable: false
      }
    }
  }
}
