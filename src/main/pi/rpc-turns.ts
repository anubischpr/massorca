import { agentSessionFailureWords } from '../../shared/agent-session-failure-words'
import type {
  AgentSessionDispatchOutcome,
  StructuredAgentSessionCommandRun
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import type { ProviderTimelineEvent } from '../native-chat/agent-session-timeline/provider-timeline-event'
import type { JsonlRpcRecord } from '../jsonl-rpc/peer'
import type { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import { PiRpcContextUsage } from './rpc-context-usage'
import { PiRpcMessages } from './rpc-messages'
import { PiRpcBackgroundJobs } from './rpc-background-jobs'
import { PiRpcUsageSync } from './rpc-usage-sync'
import type { AgentChildWorkEvidence } from '../../shared/agent-status-child-work-evidence'
import { PiRpcPromptDelivery, piRpcFailureFact } from './rpc-prompt-delivery'
import { PiRpcIdleCheck } from './rpc-idle-check'
import { piRpcRetryActivity } from './rpc-retry-activity'
import { piRpcMessageSchema } from './rpc-protocol'

export type PiRpcTurnDeps = {
  lane: JsonlRpcTimelineLane
  generation: string
  send: (frame: JsonlRpcRecord) => Promise<void>
  request: (
    command: string,
    params?: Record<string, unknown>,
    options?: { timeoutMs?: number | null }
  ) => Promise<unknown>
  settled: (id: string, outcome: AgentSessionDispatchOutcome) => void
  idle: () => void
  failed: (error: Error) => void
  diagnostic?: (error: unknown) => void
  /** Where the session's background-job child work goes; absent when the host publishes none. */
  childWork?: (evidence: AgentChildWorkEvidence[]) => void
  /** Gentle Shell wakes its own agent when a background job ends, so an agent run Orca did not
   *  dispatch is its normal operation there and a protocol violation on stock Pi. */
  acceptsAgentWake?: boolean
}

/** Prompt replies can be idless and arrive after dialogs; they have no elapsed-time deadline. */
export class PiRpcTurns {
  readonly context = new PiRpcContextUsage()
  readonly usage: PiRpcUsageSync
  private readonly messages: PiRpcMessages
  private readonly delivery: PiRpcPromptDelivery
  private readonly idleCheck: PiRpcIdleCheck
  private readonly jobs: PiRpcBackgroundJobs
  private revision = 0
  private turn = 0
  private active?: string
  private settling = false
  private compacting = false
  private stopped = false
  private ended = false
  private failure?: string
  private lastStopReason?: string

  constructor(private readonly deps: PiRpcTurnDeps) {
    this.messages = new PiRpcMessages(deps.generation, this.context)
    this.jobs = new PiRpcBackgroundJobs({
      generation: deps.generation,
      drained: () => deps.lane.drained(),
      deliver: deps.childWork,
      diagnostic: deps.diagnostic
    })
    this.usage = new PiRpcUsageSync(this.context, {
      lane: deps.lane,
      request: (command) => deps.request(command),
      diagnostic: deps.diagnostic,
      ended: () => this.ended
    })
    this.idleCheck = new PiRpcIdleCheck({
      request: () => deps.request('get_state'),
      current: (revision) =>
        !this.ended && this.settling && !this.compacting && revision === this.revision,
      settled: (state) => {
        this.usage.syncModel(state.model ?? undefined)
        this.finish()
      },
      failed: deps.failed
    })
    this.delivery = new PiRpcPromptDelivery({
      send: (frame) =>
        deps.send({ ...frame, streamingBehavior: this.working ? 'steer' : 'followUp' }),
      settled: deps.settled,
      failed: deps.failed,
      accepted: (id, at) => {
        this.open(at)
        this.deps.lane.apply([{ type: 'input.accepted', clientMessageId: id, requestedAt: at }])
      },
      commandOnly: () => {
        this.skipInitialUserEcho = false
        this.settling = true
        this.probe()
      },
      rejectedAfterAcceptance: (error) => {
        this.failure = error
      },
      beforeWrite: () => this.touch(),
      refused: () => {
        if (this.active) {
          this.settling = true
          this.probe()
        }
      }
    })
  }

  get holdsDispatch(): boolean {
    return this.delivery.holdsDispatch
  }
  get working(): boolean {
    return this.active !== undefined
  }

  async submit(
    id: string,
    at: number,
    frame: JsonlRpcRecord,
    before?: () => Promise<void>
  ): Promise<AgentSessionDispatchOutcome> {
    if (this.ended) {
      throw new Error('Pi session ended before dispatch')
    }
    return this.delivery.submit(id, at, frame, before)
  }

  receive(frame: JsonlRpcRecord): void {
    if (this.ended) {
      return
    }
    const at = Date.now()
    switch (frame.type) {
      case 'response':
        if (frame.command === 'prompt') {
          this.delivery.reply(frame)
        }
        return
      case 'agent_start':
        if (!this.active && !this.delivery.holdsDispatch && !this.deps.acceptsAgentWake) {
          throw new Error('Pi started an unsolicited agent run')
        }
        this.touch()
        this.open(at)
        this.skipInitialUserEcho = this.delivery.consumeNext()
        return
      case 'message_start':
      case 'message_update':
      case 'message_end': {
        this.touch()
        const message = piRpcMessageSchema.safeParse(frame.message)
        if (message.success && message.data.role === 'user' && frame.type === 'message_end') {
          // agent_start already accepted the first prompt; user echoes consume queued inputs.
          if (this.skipInitialUserEcho) {
            this.skipInitialUserEcho = false
          } else {
            this.delivery.consumeNext()
          }
        }
        if (message.success && message.data.role === 'assistant' && frame.type === 'message_end') {
          this.lastStopReason = message.data.stopReason
          this.failure =
            message.data.stopReason === 'error'
              ? (message.data.errorMessage ?? 'Pi request failed')
              : undefined
        }
        this.deps.lane.apply(this.messages.message(frame, at))
        this.jobs.observeFrame(frame)
        return
      }
      case 'tool_execution_start':
      case 'tool_execution_update':
      case 'tool_execution_end':
        this.touch()
        this.deps.lane.apply(this.messages.tool(frame))
        this.jobs.observeFrame(frame)
        return
      case 'turn_end':
        this.usage.refresh()
        break
      case 'agent_end':
        // This can precede automatic retry or detached compaction.
        break
      case 'agent_settled':
        this.settling = true
        this.probe()
        return
      case 'compaction_start':
      case 'auto_compaction_start':
        this.revision++
        this.compacting = true
        this.deps.lane.apply(this.context.compacting())
        return
      case 'compaction_end':
      case 'auto_compaction_end':
        this.compacting = false
        this.context.compacted(frame.result)
        if (frame.willRetry === true) {
          this.failure = undefined
          this.lastStopReason = undefined
        }
        this.usage.refresh()
        if (this.settling) {
          this.probe()
        }
        return
      case 'auto_retry_start':
        this.touch()
        this.deps.lane.apply([piRpcRetryActivity(frame)])
        return
      case 'auto_retry_end':
        this.deps.lane.apply([piRpcRetryActivity(frame)])
        if (frame.success === true) {
          this.failure = undefined
          this.lastStopReason = undefined
        } else {
          this.failure =
            typeof frame.finalError === 'string' ? frame.finalError : 'Pi auto-retry failed'
        }
        break
    }
  }

  stop(): void {
    this.stopped = true
  }

  beginCommand(command: StructuredAgentSessionCommandRun): void {
    if (this.active) {
      throw new Error('Pi is still working')
    }
    this.deps.lane.beginCommand(command)
    this.active = command.turnId
    this.failure = undefined
    this.lastStopReason = undefined
    this.stopped = false
    this.revision++
  }

  commandCompleted(): void {
    this.settling = true
    this.probe()
  }

  commandRejected(): void {
    if (this.active) {
      this.deps.lane.forgetCommand(this.active)
    }
    this.active = undefined
    this.settling = false
    this.revision++
  }

  end(): void {
    this.jobs.clear()
    this.ended = true
    this.revision++
    this.idleCheck.dispose()
    this.delivery.end()
  }

  private skipInitialUserEcho = false
  private open(at: number): void {
    if (this.active) {
      return
    }
    this.active = `run:${this.deps.generation}:${++this.turn}`
    this.failure = undefined
    this.lastStopReason = undefined
    this.stopped = false
    this.skipInitialUserEcho = true
    this.deps.lane.apply([{ type: 'turn.open', turn: this.active, at }])
  }

  private probe(): void {
    this.idleCheck.schedule(this.revision)
  }

  private finish(): void {
    if (!this.active) {
      this.settling = false
      return
    }
    const outcome = this.stopped
      ? 'cancellation'
      : this.failure || this.lastStopReason === 'error'
        ? 'failure'
        : 'success'
    const events: ProviderTimelineEvent[] = []
    if (outcome === 'failure' && this.failure) {
      const fact = piRpcFailureFact(this.failure)
      events.push({
        type: 'item.close',
        item: `error:${this.active}`,
        body: {
          kind: 'status',
          tone: 'error',
          ...agentSessionFailureWords(fact, { agentName: 'Pi', surface: 'row' })
        }
      })
    }
    events.push({
      type: 'turn.end',
      at: Date.now(),
      state: this.stopped ? 'interrupted' : 'completed',
      outcome
    })
    this.deps.lane.apply(events)
    this.active = undefined
    this.settling = false
    this.messages.reset()
    this.deps.idle()
  }

  private touch(): void {
    this.revision++
    this.settling = false
  }
}
