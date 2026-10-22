import { AGENT_CHILD_WORK_LAST_MESSAGE_MAX_LENGTH } from '../../shared/agent-status-child-work'
import type { AgentChildWorkOutcome } from '../../shared/agent-status-child-work'
import type { AgentChildWorkEvidence } from '../../shared/agent-status-child-work-evidence'
import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import { stripTerminalControl } from '../../shared/terminal-control-stripping'
import type { JsonlRpcRecord } from '../jsonl-rpc/peer'
import {
  GENTLE_BASH_BACKGROUND_TOOL,
  GENTLE_JOB_NOTICE_TYPE,
  GENTLE_JOB_STOP_TOOL,
  GENTLE_MONITOR_TOOL,
  readGentleJobFacts,
  readGentleJobUnreadableExit,
  type GentleJobFacts
} from './gentle-shell-job-details'
import { piRpcToolEventSchema, type PiRpcToolEvent } from './rpc-protocol'
import { PiRpcGentleWorkers } from './rpc-gentle-shell-workers'

// Gentle Shell's background jobs (`bash_background`, `monitor`), read as the child work the chat's
// Background tasks lists; its workers (`subagent_run`) ride the same sink as subagents. A job is live from the tool result that started it until its own exit
// notice, a `job_stop` result, or the end of the session. Only what Gentle Shell published is used:
// the start result's job id, the call's command and label, and the notice's outcome and output tail.

const MAX_LIVE_JOBS = 64
const MAX_PENDING_ARGS = 64

type LiveJob = {
  handleId: string
  kind: 'command' | 'monitor'
  runId: string
  label?: string
  command?: string
  lastMessage?: string
}

export type PiRpcBackgroundJobsDeps = {
  generation: string
  /** Resolves once the journal holds every frame seen so far, so child work never leads its row. */
  drained: () => Promise<void>
  /** The host's child-work sink; absent when the host publishes none. */
  deliver?: (evidence: AgentChildWorkEvidence[]) => void
  diagnostic?: (error: unknown) => void
}

type PendingEdge = (observedAt: number) => AgentChildWorkEvidence

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

/** The newest output, tail-first: a result is the end of the stream, not its head. */
function tailText(lines: readonly string[]): string | undefined {
  const joined = stripTerminalControl(lines.join(' ⏎ ')).trim()
  return joined.slice(-AGENT_CHILD_WORK_LAST_MESSAGE_MAX_LENGTH).trim() || undefined
}

/** The "Last output:" lines of an exit notice, which Gentle Shell prints between two fixed markers. */
function noticeOutput(content: string): string[] {
  const lines = content.split('\n')
  const start = lines.lastIndexOf('Last output:')
  if (start === -1) {
    return []
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith('Full output: '))
  return lines.slice(start + 1, end === -1 ? undefined : end).filter((line) => line.trim())
}

/** The lines of a monitor event notice, without its header and its "more lines" footer. */
function monitorEventLines(content: string): string[] {
  return content
    .split('\n')
    .slice(1)
    .filter((line) => line.trim() && !/^\(\d+ more lines? not shown;/.test(line))
}

function outcomeOf(facts: GentleJobFacts): AgentChildWorkOutcome {
  if (facts.status === 'stopped') {
    return 'cancelled'
  }
  if (facts.status === 'failed') {
    return 'failed'
  }
  if (facts.status === 'exited' && typeof facts.exitCode === 'number') {
    return facts.exitCode === 0 ? 'succeeded' : 'failed'
  }
  return 'unknown'
}

/** Decodes Gentle Shell's job tool results and notices into child-work edges. Edges wait until the
 *  frame that caused them is journaled, then take the host clock. */
export class PiRpcBackgroundJobs {
  private readonly args = new Map<string, { command?: string; label?: string }>()
  private readonly live = new Map<string, LiveJob>()
  private readonly workers: PiRpcGentleWorkers
  private pending: PendingEdge[] = []
  /** Batches deliver one after another, so an `ended` edge never overtakes its `live` edge. */
  private publishing: Promise<void> = Promise.resolve()

  constructor(private readonly deps: PiRpcBackgroundJobsDeps) {
    this.workers = new PiRpcGentleWorkers(deps.generation)
  }

  /** A frame the turn machine received: a job's tool call or result, or a custom message. */
  observeFrame(frame: JsonlRpcRecord): void {
    this.pending.push(...this.workers.observeFrame(frame))
    const tool = piRpcToolEventSchema.safeParse(frame)
    if (tool.success) {
      this.observeTool(tool.data)
    } else if (frame.type === 'message_end') {
      this.observeNotice(frame.message)
    }
    this.publish()
  }

  /** The provider session is gone: the host settles what it still holds live. */
  clear(): void {
    this.args.clear()
    this.live.clear()
    this.workers.clear()
    this.pending.push((observedAt) => ({ type: 'session-ended', observedAt }))
    this.publish()
  }

  private observeTool(event: PiRpcToolEvent): void {
    const { toolName } = event
    if (toolName === GENTLE_BASH_BACKGROUND_TOOL || toolName === GENTLE_MONITOR_TOOL) {
      this.observeStart(event, toolName === GENTLE_MONITOR_TOOL ? 'monitor' : 'command')
    } else if (toolName === GENTLE_JOB_STOP_TOOL && event.type === 'tool_execution_end') {
      const facts = this.resultFacts(event, 'command')
      const job = facts && this.live.get(facts.jobId)
      if (facts?.status === 'stopped' && job) {
        this.end(job, facts.jobId, 'cancelled')
      }
    }
  }

  private observeNotice(message: unknown): void {
    if (!isRecord(message) || message.customType !== GENTLE_JOB_NOTICE_TYPE) {
      return
    }
    const facts = readGentleJobFacts(message.details, 'command')
    if (!facts) {
      // A status this build does not know still names the job it ends; leaving it live would
      // show it working until the session ends.
      const unreadableExit = readGentleJobUnreadableExit(message.details)
      const unreadableJob = unreadableExit && this.live.get(unreadableExit)
      if (unreadableExit && unreadableJob) {
        this.end(unreadableJob, unreadableExit, 'unknown')
      }
      return
    }
    const job = this.live.get(facts.jobId)
    if (!job) {
      return
    }
    const content = typeof message.content === 'string' ? message.content : ''
    if (facts.event === 'events') {
      job.lastMessage = tailText(monitorEventLines(content).slice(-3)) ?? job.lastMessage
      this.pending.push((observedAt) => this.liveEdge(job, observedAt))
      return
    }
    // A monitor the harness stopped, or a job that never ran, says why in its first line.
    const reason = facts.event !== undefined || facts.status === 'failed'
    const lastMessage = tailText(
      reason ? content.split('\n').slice(0, 1) : noticeOutput(content).slice(-3)
    )
    this.end(
      job,
      facts.jobId,
      facts.event === undefined ? outcomeOf(facts) : 'cancelled',
      lastMessage
    )
  }

  private resultFacts(event: PiRpcToolEvent, kind: 'command' | 'monitor') {
    const result = isRecord(event.result) ? event.result : undefined
    return event.isError === true ? undefined : readGentleJobFacts(result?.details, kind)
  }

  private observeStart(event: PiRpcToolEvent, kind: 'command' | 'monitor'): void {
    if (event.type === 'tool_execution_start') {
      const args = isRecord(event.args) ? event.args : undefined
      if (this.args.size >= MAX_PENDING_ARGS) {
        this.args.delete(this.args.keys().next().value ?? '')
      }
      this.args.set(event.toolCallId, { command: text(args?.command), label: text(args?.label) })
      return
    }
    if (event.type !== 'tool_execution_end') {
      return
    }
    const args = this.args.get(event.toolCallId)
    this.args.delete(event.toolCallId)
    const facts = this.resultFacts(event, kind)
    if (!facts || facts.status !== 'running' || this.live.has(facts.jobId)) {
      return
    }
    if (this.live.size >= MAX_LIVE_JOBS) {
      return
    }
    const label = args?.label ?? facts.label
    const job: LiveJob = {
      handleId: `gentle-job:${this.deps.generation}:${facts.jobId}`,
      kind: facts.kind,
      runId: event.toolCallId,
      ...(label ? { label } : {}),
      ...(args?.command ? { command: args.command } : {})
    }
    this.live.set(facts.jobId, job)
    this.pending.push((observedAt) => this.liveEdge(job, observedAt))
  }

  private end(
    job: LiveJob,
    jobId: string,
    outcome: AgentChildWorkOutcome,
    lastMessage?: string
  ): void {
    this.live.delete(jobId)
    this.pending.push((observedAt) => ({
      type: 'ended',
      observedAt,
      handle: { idKind: 'task_id', id: job.handleId, runId: job.runId },
      outcome,
      ...(lastMessage ? { lastMessage } : {})
    }))
  }

  private liveEdge(job: LiveJob, observedAt: number): AgentChildWorkEvidence {
    return {
      type: 'live',
      observedAt,
      child: {
        handle: { idKind: 'task_id', id: job.handleId, runId: job.runId },
        kind: job.kind,
        residency: 'background',
        state: 'working',
        ...(job.label ? { name: job.label } : {}),
        ...(job.command || job.label ? { description: job.command ?? job.label } : {}),
        ...(job.lastMessage ? { lastMessage: job.lastMessage } : {}),
        // Gentle Shell stops a job only through its model tool or its terminal view.
        stoppable: false
      }
    }
  }

  private publish(): void {
    const edges = this.pending
    this.pending = []
    const { deliver } = this.deps
    if (edges.length === 0 || !deliver) {
      return
    }
    this.publishing = this.publishing
      .then(() => this.deps.drained())
      .then(() => deliver(edges.map((edge) => edge(Date.now()))))
      .catch((error: unknown) => this.deps.diagnostic?.(error))
  }
}
