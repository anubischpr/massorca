import type { AgentSessionOptionsResult } from '../../shared/agent-session-wire'
import type {
  StructuredAgentSessionAcquireInput,
  StructuredAgentSessionLifecycleEvent,
  AgentSessionDispatchOutcome
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import type { AgentChildWorkEvidence } from '../../shared/agent-status-child-work-evidence'
import type { StructuredAgentSessionLogger } from '../native-chat/agent-session-wire/structured-agent-session-logger'
import type { PiRpcCommandCatalog } from './rpc-command-catalog'
import { providerTimelineSink } from '../native-chat/agent-session-timeline/provider-timeline-plan'
import { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import {
  JsonlRpcAgentConnection,
  type JsonlRpcAgentConnectionOptions
} from '../jsonl-rpc/agent-connection'
import type { ProviderProcessLaunch } from '../provider-process/provider-process-launch'
import { PiRpcTurns } from './rpc-turns'
import { awaitTimelineDrain } from './rpc-exit-drain'
import { PiRpcSessionCommands } from './rpc-session-commands'
import { PiRpcDialogCallbacks } from './rpc-dialog-callbacks'
import { piRpcStateSchema } from './rpc-protocol'
import { readPiRpcSessionOptions, restorePiRpcSessionOptions } from './rpc-options'
import { GentleShellModeControl, type GentleShellMode } from './gentle-shell-permission-mode'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'

export type PiRpcConnection = Pick<
  JsonlRpcAgentConnection,
  | 'request'
  | 'send'
  | 'close'
  | 'pauseReading'
  | 'resumeReading'
  | 'pid'
  | 'closed'
  | 'rootVerdict'
  | 'processless'
  | 'lastCloseResult'
  | 'onExit'
>
export type PiRpcSessionDeps = {
  openConnection?: (
    launch: ProviderProcessLaunch,
    handlers: JsonlRpcAgentConnectionOptions
  ) => PiRpcConnection
  onLifecycle: (event: StructuredAgentSessionLifecycleEvent) => void
  onSettled: (input: {
    sessionId: string
    clientMessageId: string
    fence: number
    outcome: AgentSessionDispatchOutcome
  }) => void
  onIdle: (input: { sessionId: string }) => void
  /** The host's sink for a session's child work (Gentle Shell background jobs). */
  onChildWorkEvidence?: (sessionId: string, evidence: AgentChildWorkEvidence[]) => void
  /** Remembers what a running child reports as its `/` commands, for a chat whose child is not running. */
  commandCatalog?: Pick<PiRpcCommandCatalog, 'record' | 'atRestCommands'>
  logger: StructuredAgentSessionLogger
}

/** One child owns its transport, dialect, dialogs and timeline, including shutdown retries. */
export class PiRpcSession {
  readonly connection: PiRpcConnection
  readonly lane: JsonlRpcTimelineLane
  readonly turns: PiRpcTurns
  readonly dialogs: PiRpcDialogCallbacks
  readonly gentle: GentleShellModeControl
  readonly selected = new Map<string, string>()
  readonly skipped: string[] = []
  readonly slash: PiRpcSessionCommands
  options?: AgentSessionOptionsResult
  /** The agent dir the child runs under, for config the child itself never reports. */
  agentDir?: string
  requestedClose = false
  private publishedExit = false
  private failedCause?: Error
  private exitDelivery: Promise<void> = Promise.resolve()
  private releaseAfterExit?: () => void

  constructor(
    readonly input: StructuredAgentSessionAcquireInput,
    readonly generation: string,
    launch: ProviderProcessLaunch,
    private readonly deps: PiRpcSessionDeps,
    /** The runtime the launch spawned; a saved record's options may not name it. */
    readonly piRuntime: PiRuntimeSelection
  ) {
    const sink = input.events && providerTimelineSink(input.events)
    if (!sink) {
      throw new Error('Pi structured chat requires the shared timeline sink')
    }
    this.lane = new JsonlRpcTimelineLane({
      sink,
      sessionId: input.identity.sessionId,
      agent: 'pi',
      generation,
      namespace: input.identity.sessionId,
      pauseReading: () => this.connection?.pauseReading(),
      resumeReading: () => this.connection?.resumeReading(),
      onFailed: (reason) => this.fail(new Error(reason)),
      onInputAccepted: (clientMessageId) =>
        this.settle(clientMessageId, {
          state: 'accepted',
          providerIdentity: { provider: 'orca', clientMessageId }
        })
    })
    this.turns = new PiRpcTurns({
      lane: this.lane,
      generation,
      send: (frame) => this.connection.send(frame),
      request: (command, params, options) => this.connection.request(command, params, options),
      settled: (id, outcome) => this.settle(id, outcome),
      idle: () => {
        this.dialogs.cancelAll()
        if (this.slash.list === undefined) {
          void this.slash.read()
        }
        deps.onIdle({ sessionId: input.identity.sessionId })
      },
      failed: (error) => this.fail(error),
      acceptsAgentWake: piRuntime === 'gentle-shell',
      ...(deps.onChildWorkEvidence
        ? {
            childWork: (evidence) => deps.onChildWorkEvidence?.(input.identity.sessionId, evidence)
          }
        : {}),
      diagnostic: (error) =>
        deps.logger.warn('Pi context usage could not be read', {
          scope: 'pi-context-usage',
          sessionId: input.identity.sessionId,
          error
        })
    })
    this.dialogs = new PiRpcDialogCallbacks(
      this.lane,
      (frame) => this.connection.send(frame),
      (error) => this.fail(error)
    )
    this.connection = (
      deps.openConnection ?? ((spec, handlers) => new JsonlRpcAgentConnection(spec, handlers))
    )(launch, {
      ...(input.onOutput ? { onOutput: input.onOutput } : {}),
      onRecord: (frame) =>
        frame.type === 'extension_ui_request'
          ? this.dialogs.receive(frame)
          : this.turns.receive(frame),
      onClose: (error) => this.fail(error),
      onDiagnostic: (message) =>
        deps.logger.warn(message, { scope: 'pi-rpc', sessionId: input.identity.sessionId }),
      onExit: (error) => {
        this.exitDelivery = this.exit(error)
          .catch((cause: unknown) =>
            deps.logger.error('Pi exit publication failed', {
              scope: 'pi-exit',
              sessionId: input.identity.sessionId,
              error: cause
            })
          )
          .finally(() => this.releaseAfterExit?.())
      }
    })
    this.slash = new PiRpcSessionCommands({
      rpc: this.connection,
      runtime: piRuntime,
      catalog: deps.commandCatalog,
      logger: deps.logger,
      sessionId: input.identity.sessionId
    })
    this.gentle = new GentleShellModeControl({
      enabled: piRuntime === 'gentle-shell',
      rpc: this.connection,
      commands: () => this.slash.list,
      busy: () => this.turns.working || this.turns.holdsDispatch,
      warn: (message, fields) =>
        deps.logger.warn(message, {
          scope: 'pi-gentle-mode',
          sessionId: input.identity.sessionId,
          ...fields
        }),
      notice: (text) => this.lane.apply([{ type: 'activity', text }])
    })
  }

  async start(gentleMode?: GentleShellMode): Promise<string> {
    const state = piRpcStateSchema.parse(await this.connection.request('get_state'))
    this.lane.apply(this.turns.context.setModel(state.model ?? undefined, Date.now()))
    this.skipped.push(
      ...(await restorePiRpcSessionOptions(
        this.connection,
        this.selected,
        this.input.options ?? {},
        (key, error) =>
          this.deps.logger.warn('Pi rejected a saved option', {
            scope: 'pi-option-restore',
            sessionId: this.input.identity.sessionId,
            key,
            error
          })
      ))
    )
    this.options = await readPiRpcSessionOptions(this.connection)
    await this.turns.usage.resync(true)
    await this.slash.read()
    if (gentleMode && !(await this.gentle.applyAtStart(gentleMode))) {
      // The child starts in full access, so only that pick may run without its narrowing.
      if (gentleMode !== 'yolo') {
        throw new Error('Gentle Shell could not apply the selected permission mode')
      }
      this.skipped.push('accessMode')
    }
    return state.sessionFile
  }

  async close(requested = true): ReturnType<PiRpcConnection['close']> {
    this.requestedClose ||= requested
    this.dialogs.cancelAll()
    return this.connection.close()
  }

  fail(error: Error): void {
    this.failedCause ??= error
    this.deps.logger.error('Pi RPC session failed', {
      scope: 'pi-rpc',
      sessionId: this.input.identity.sessionId,
      error
    })
    void this.close(false)
      .then((result) => {
        if (result.root !== 'exited') {
          this.deps.logger.warn('Pi process exit is unverifiable', {
            scope: 'pi-stop',
            sessionId: this.input.identity.sessionId
          })
        }
      })
      .catch((cause: unknown) =>
        this.deps.logger.error('Pi process cleanup failed', {
          scope: 'pi-stop',
          sessionId: this.input.identity.sessionId,
          error: cause
        })
      )
  }

  drainObservedExit(): Promise<void> {
    return this.exitDelivery
  }

  retire(): Promise<void> {
    return new Promise((resolve) => {
      this.releaseAfterExit = () => {
        this.releaseAfterExit = undefined
        void this.lane.drained().then(() => {
          this.lane.dispose()
          resolve()
        })
      }
      if (this.publishedExit) {
        void this.exitDelivery.then(() => this.releaseAfterExit?.())
      }
    })
  }

  private async exit(error: Error): Promise<void> {
    if (this.publishedExit) {
      return
    }
    this.publishedExit = true
    this.dialogs.cancelAll()
    this.turns.end()
    this.lane.finalize()
    this.lane.apply([
      { type: 'session.ended', verdict: { state: 'interrupted', completedAt: Date.now() } }
    ])
    this.lane.flush()
    await awaitTimelineDrain(this.lane, () =>
      this.deps.logger.warn('Pi final timeline did not drain before exit publication', {
        scope: 'pi-exit-drain',
        sessionId: this.input.identity.sessionId
      })
    )
    this.deps.onLifecycle({
      type: 'ended',
      sessionId: this.input.identity.sessionId,
      fence: this.input.fence,
      acquisitionGeneration: this.generation,
      observedAt: Date.now(),
      cause: this.requestedClose ? 'requested-close' : 'unexpected-exit',
      reason: (this.failedCause ?? error).message
    })
  }

  private settle(clientMessageId: string, outcome: AgentSessionDispatchOutcome): void {
    this.deps.onSettled({
      sessionId: this.input.identity.sessionId,
      clientMessageId,
      fence: this.input.fence,
      outcome
    })
  }
}
