import { isAbsolute } from 'node:path'
import type {
  StructuredAgentSessionAcquireInput,
  StructuredAgentSessionLifecycleEvent,
  AgentSessionDispatchOutcome
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import { providerTimelineSink } from '../native-chat/agent-session-timeline/provider-timeline-plan'
import { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import {
  spawnManagedProviderProcess,
  type ManagedProviderProcess
} from '../provider-process/managed-provider-process'
import type { ProviderProcessLaunch } from '../provider-process/provider-process-launch'
import { waitForProcessExitUntil } from '../provider-process/provider-process-exit-deadline'
import { AntigravityStreamJsonTransport } from './antigravity-stream-json-transport'
import { AntigravityStreamEventProjector } from './antigravity-stream-json-events'
import { AntigravitySubagentChildWork } from './antigravity-subagent-child-work'
import type { AntigravityLaunchOptionKey } from './antigravity-session-options'
import { agentSessionFailureFact, providerDiagnostic } from '../../shared/agent-session-failure'
import type { AgentChildWorkEvidence } from '../../shared/agent-status-child-work-evidence'

/** How long a close waits for the root's exit after the teardown signalled it; a killed root exits in ms. */
const ROOT_EXIT_GRACE_MS = 2_000

export type AntigravitySessionDeps = {
  processFactory?: (launch: ProviderProcessLaunch) => ManagedProviderProcess
  onLifecycle: (event: StructuredAgentSessionLifecycleEvent) => void
  onSettled: (input: {
    sessionId: string
    clientMessageId: string
    outcome: AgentSessionDispatchOutcome
  }) => void
  onIdle: (input: { sessionId: string }) => void
  onChildWorkEvidence?: (sessionId: string, evidence: AgentChildWorkEvidence[]) => void
  logger: StructuredAgentSessionLogger
}

/** Owns the process, bounded semantic timeline and outstanding echo acknowledgements. */
export class AntigravityStructuredSession {
  readonly process: ManagedProviderProcess
  readonly transport: AntigravityStreamJsonTransport
  readonly lane: JsonlRpcTimelineLane
  readonly pending = new Set<string>()
  /** Model and effort picks made since launch; each takes effect at the child's next start. */
  readonly picks = new Map<AntigravityLaunchOptionKey, string>()
  /** The child's home, where agy reads its MCP configuration; undefined when the launch names none. */
  readonly configHome: string | undefined
  private readonly unacknowledged = new Set<string>()
  private readonly echoed = new Set<string>()
  private readonly requestedAt = new Map<string, number>()
  private readonly subagents = new AntigravitySubagentChildWork()
  private ended = false
  private requestedClose = false
  private exitDelivery: Promise<void> = Promise.resolve()

  constructor(
    readonly input: StructuredAgentSessionAcquireInput,
    readonly generation: string,
    launch: ProviderProcessLaunch,
    private readonly deps: AntigravitySessionDeps
  ) {
    const home = launch.env?.HOME ?? launch.env?.USERPROFILE
    this.configHome = home && isAbsolute(home) ? home : undefined
    const sink = input.events && providerTimelineSink(input.events)
    if (!sink) {
      throw new Error('Antigravity structured chat requires the shared timeline sink')
    }
    this.lane = new JsonlRpcTimelineLane({
      sink,
      sessionId: input.identity.sessionId,
      agent: 'antigravity',
      generation,
      namespace: input.identity.sessionId,
      pauseReading: () => this.process?.child.stdout.pause(),
      resumeReading: () => this.process?.child.stdout.resume(),
      onFailed: (reason) => this.fail(new Error(reason)),
      onInputAccepted: (clientMessageId) => {
        this.unacknowledged.delete(clientMessageId)
        deps.onSettled({
          sessionId: input.identity.sessionId,
          clientMessageId,
          outcome: { state: 'accepted', providerIdentity: { provider: 'orca', clientMessageId } }
        })
      }
    })
    const projector = new AntigravityStreamEventProjector()
    const process = (
      deps.processFactory ??
      ((spec) =>
        spawnManagedProviderProcess(spec, {
          site: 'antigravity-structured-session',
          ...(input.onOutput ? { onOutput: input.onOutput } : {})
        }))
    )(launch)
    this.process = process
    this.transport = new AntigravityStreamJsonTransport({
      launch,
      processFactory: () => process,
      onEvent: (event) => {
        if (this.ended) {
          return
        }
        if (event.type === 'step_update' && event.step.step_type === 'user_input') {
          this.echoed.add(event.clientMessageId)
        }
        this.lane.apply(
          projector.apply(
            event.type === 'step_update'
              ? {
                  ...event,
                  requestedAt: this.requestedAt.get(event.clientMessageId) ?? event.requestedAt
                }
              : event
          )
        )
        this.publishChildWork(this.subagents.observe(event))
        if (event.type === 'result' && event.terminal) {
          this.pending.delete(event.clientMessageId)
          this.requestedAt.delete(event.clientMessageId)
          if (
            !this.echoed.has(event.clientMessageId) &&
            this.unacknowledged.delete(event.clientMessageId)
          ) {
            deps.onSettled({
              sessionId: input.identity.sessionId,
              clientMessageId: event.clientMessageId,
              outcome: {
                state: 'unknown',
                reason: event.result.error ?? 'Antigravity ended before acknowledging the input'
              }
            })
          }
          this.echoed.delete(event.clientMessageId)
          void this.lane.drained().then(() => {
            if (!this.ended && this.pending.size === 0) {
              deps.onIdle({ sessionId: input.identity.sessionId })
            }
          })
        }
      },
      onError: (error) => this.fail(error),
      onExit: () => {
        this.exitDelivery = this.publishExit().catch((error: unknown) => {
          deps.logger.error('Antigravity exit publication failed', {
            scope: 'antigravity-exit',
            error
          })
        })
      }
    })
  }

  submit(id: string, text: string, requestedAt = Date.now()): void {
    if (this.ended || this.pending.has(id)) {
      throw new Error('Antigravity input is not admissible')
    }
    if (this.pending.size >= 64) {
      throw new Error('Antigravity prompt queue capacity exceeded')
    }
    this.pending.add(id)
    this.unacknowledged.add(id)
    this.requestedAt.set(id, requestedAt)
    void this.transport.submitPrompt(id, text).catch((error: unknown) => {
      this.pending.delete(id)
      this.requestedAt.delete(id)
      if (this.unacknowledged.delete(id)) {
        this.deps.onSettled({
          sessionId: this.input.identity.sessionId,
          clientMessageId: id,
          outcome: { state: 'unknown', reason: String(error) }
        })
      }
    })
  }

  async cancel(): Promise<boolean> {
    this.requestedClose = true
    const result = await this.transport.cancel()
    await this.exitDelivery
    return result.root === 'exited' && this.process.rootExitObserved
  }

  async close(requested = true): Promise<boolean> {
    this.requestedClose ||= requested
    const tree = await this.transport.terminate()
    // The teardown has signalled the root, which may exit on the signal or once its descendants are
    // gone. A bounded wait lets that exit count, instead of judging before it lands.
    await waitForProcessExitUntil(this.process.exitPromise, ROOT_EXIT_GRACE_MS)
    await this.exitDelivery
    return tree === 'exited' && this.process.rootExitObserved
  }
  drainObservedExit(): Promise<void> {
    return this.exitDelivery
  }
  retire(): void {
    this.lane.dispose()
  }

  fail(error: Error): void {
    this.deps.logger.error('Antigravity structured session failed', {
      scope: 'antigravity-stream',
      error
    })
    void this.close(false).catch((cause: unknown) =>
      this.deps.logger.error('Antigravity cleanup failed', {
        scope: 'antigravity-stop',
        error: cause
      })
    )
  }

  private publishChildWork(evidence: AgentChildWorkEvidence[]): void {
    if (evidence.length === 0) {
      return
    }
    try {
      this.deps.onChildWorkEvidence?.(this.input.identity.sessionId, evidence)
    } catch (error: unknown) {
      this.deps.logger.error('Antigravity child work publication failed', {
        scope: 'antigravity-child-work',
        error
      })
    }
  }

  private async publishExit(): Promise<void> {
    if (this.ended) {
      return
    }
    this.ended = true
    this.publishChildWork(this.subagents.sessionEnded())
    this.lane.finalize()
    this.lane.apply([
      { type: 'session.ended', verdict: { state: 'interrupted', completedAt: Date.now() } }
    ])
    this.lane.flush()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        this.lane.drained(),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, 2_000)
          timer.unref()
        })
      ])
    } finally {
      clearTimeout(timer)
    }
    for (const id of this.unacknowledged) {
      this.deps.onSettled({
        sessionId: this.input.identity.sessionId,
        clientMessageId: id,
        outcome: { state: 'unknown', reason: 'Antigravity exited before acknowledging the input' }
      })
    }
    this.pending.clear()
    this.unacknowledged.clear()
    this.requestedAt.clear()
    this.deps.onLifecycle({
      type: 'ended',
      sessionId: this.input.identity.sessionId,
      fence: this.input.fence,
      acquisitionGeneration: this.generation,
      observedAt: Date.now(),
      cause: this.requestedClose ? 'requested-close' : 'unexpected-exit',
      reason: 'Antigravity process exited',
      failure: this.requestedClose
        ? agentSessionFailureFact('hostFault')
        : agentSessionFailureFact('providerExited', {
            detail: providerDiagnostic(this.process.stderrTail(), 'person')
          })
    })
  }
}
