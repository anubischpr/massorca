import { encodeNdjson, type IncrementalNdjsonFramer } from '../../shared/main-process-ndjson-framer'
import {
  spawnManagedProviderProcess,
  type ManagedProviderProcess
} from '../provider-process/managed-provider-process'
import type { ProviderProcessCloseResult } from '../provider-process/provider-process-close'
import type { ProviderProcessTeardownVerdict } from '../provider-process/provider-process-teardown'
import {
  AntigravityStreamProtocolError,
  AntigravityStreamStepFrameError,
  isAntigravityTerminalStatus,
  parseAntigravityStreamRecord,
  type AntigravityStreamResult,
  type AntigravityStreamStepUpdate
} from './antigravity-stream-json-protocol'
import type {
  AntigravityPendingPrompt,
  AntigravityStreamJsonTransportOptions,
  AntigravityStreamTransportEvent
} from './antigravity-stream-json-transport-contract'
import { AntigravityStreamFailure, asAntigravityError } from './antigravity-stream-json-failure'
import { createAntigravityStreamFramer } from './antigravity-stream-json-framing'

export {
  AntigravityStreamProtocolError,
  parseAntigravityStreamRecord
} from './antigravity-stream-json-protocol'
export type {
  AntigravityStreamResult,
  AntigravityStreamStatus,
  AntigravityStreamStepUpdate,
  AntigravityStreamUsage,
  AntigravityStreamWireRecord
} from './antigravity-stream-json-protocol'

export type {
  AntigravityStreamJsonTransportOptions,
  AntigravityStreamTransportEvent
} from './antigravity-stream-json-transport-contract'
/** Owns one Antigravity stream-json child and serializes prompts at result boundaries. */
export class AntigravityStreamJsonTransport {
  readonly ready: Promise<string>

  private readonly process: ManagedProviderProcess
  private readonly framer: IncrementalNdjsonFramer
  private readonly queue: AntigravityPendingPrompt[] = []
  private readonly seenMessageIds = new Set<string>()
  private resolveReady!: (conversationId: string) => void
  private rejectReady!: (error: Error) => void
  private conversationId: string | null = null
  private active: AntigravityPendingPrompt | null = null
  private lastStepIndex = -1
  private lastTerminalTurns = 0
  private hasTerminalResult = false
  private failure!: AntigravityStreamFailure
  private closed = false
  private expectedExit = false

  constructor(private readonly options: AntigravityStreamJsonTransportOptions) {
    this.process = (
      options.processFactory ??
      ((launch) => spawnManagedProviderProcess(launch, { site: 'antigravity-stream-json' }))
    )(options.launch)
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    void this.ready.catch(() => {})
    this.framer = createAntigravityStreamFramer(
      (record) => this.acceptRecord(record),
      (error) => this.failure.fail(error),
      options.maxLineBytes
    )
    this.failure = new AntigravityStreamFailure({
      process: this.process,
      framer: this.framer,
      rejectReady: (error) => this.rejectReady(error),
      rejectPending: (error) => this.rejectPending(error),
      hasPending: () => this.active !== null || this.queue.length > 0 || !this.conversationId,
      isExpectedExit: () => this.expectedExit,
      onError: options.onError,
      ...(options.onExit ? { onExit: options.onExit } : {})
    })
    this.process.child.stdout
      .setEncoding('utf8')
      .on('data', (chunk: string) => this.framer.feed(chunk))
    this.process.child.stdin.on('error', (error: Error) => this.failure.fail(error))
    this.process.onExit((exit) => this.failure.handleExit(exit))
  }

  submitPrompt(clientMessageId: string, message: string): Promise<AntigravityStreamResult> {
    if (this.failure.error) {
      return Promise.reject(this.failure.error)
    }
    if (this.closed) {
      return Promise.reject(new Error('Antigravity stream transport is closed'))
    }
    if (!clientMessageId || this.seenMessageIds.has(clientMessageId)) {
      return Promise.reject(new Error('Antigravity prompt requires a unique clientMessageId'))
    }
    this.seenMessageIds.add(clientMessageId)
    const result = new Promise<AntigravityStreamResult>((resolve, reject) => {
      this.queue.push({
        clientMessageId,
        message,
        resolve,
        reject,
        accepted: false,
        acceptedStepIndex: null,
        requestedAt: 0
      })
    })
    this.pump()
    return result
  }

  close(): Promise<ProviderProcessCloseResult> {
    if (this.active || this.queue.length > 0) {
      const error = new Error('Cannot close Antigravity while a prompt is pending')
      this.failure.fail(error)
      return Promise.reject(error)
    }
    this.closed = true
    this.expectedExit = this.conversationId !== null
    return this.process.close()
  }

  cancel(): Promise<ProviderProcessCloseResult> {
    this.closed = true
    this.expectedExit = true
    this.rejectPending(new Error('Antigravity prompt was cancelled'))
    return this.process.close()
  }

  private rejectPending(error: Error): void {
    this.active?.reject(error)
    this.active = null
    for (const pending of this.queue.splice(0)) {
      pending.reject(error)
    }
  }

  terminate(): Promise<ProviderProcessTeardownVerdict> {
    this.expectedExit =
      this.conversationId !== null && this.active === null && this.queue.length === 0
    this.closed = true
    return this.process.terminateTree()
  }

  private acceptRecord(value: unknown): void {
    if (this.closed || this.failure.error) {
      return
    }
    try {
      const record = parseAntigravityStreamRecord(value)
      if (record.event === 'init') {
        if (this.conversationId !== null) {
          throw new AntigravityStreamProtocolError('Antigravity emitted more than one init event')
        }
        this.conversationId = record.conversation_id
        this.resolveReady(record.conversation_id)
        this.emit({ type: 'initialized', conversationId: record.conversation_id })
        this.pump()
        return
      }
      if (!this.conversationId) {
        throw new AntigravityStreamProtocolError('Antigravity emitted data before init')
      }
      if (
        record.event === 'unknown' &&
        (record.eventName === 'control_request' || record.eventName === 'control_response')
      ) {
        throw new AntigravityStreamProtocolError('Antigravity control events are unsupported')
      }
      if (record.event === 'step_update') {
        this.acceptStep(record.step_update)
      } else if (record.event === 'result') {
        this.acceptResult(record.result)
      }
    } catch (error) {
      if (error instanceof AntigravityStreamStepFrameError) {
        this.emit({ type: 'unclassified_step', field: error.field, fieldKinds: error.fieldKinds })
        return
      }
      this.failure.fail(asAntigravityError(error))
    }
  }

  private acceptStep(step: AntigravityStreamStepUpdate): void {
    this.assertConversation(step.conversation_id)
    if (step.step_index < this.lastStepIndex) {
      return
    }
    const pending = this.active
    if (!pending) {
      if (step.step_index <= this.lastStepIndex) {
        return
      }
      throw new AntigravityStreamProtocolError(
        'Antigravity emitted a step without an active prompt'
      )
    }
    if (!pending.accepted && step.step_index <= this.lastStepIndex) {
      return
    }
    if (step.step_index > this.lastStepIndex) {
      this.lastStepIndex = step.step_index
    }
    if (step.step_type === 'user_input') {
      if (!pending.accepted) {
        pending.accepted = true
        pending.acceptedStepIndex = step.step_index
        this.emit({
          type: 'step_update',
          step,
          clientMessageId: pending.clientMessageId,
          requestedAt: pending.requestedAt
        })
      }
      if (pending.acceptedStepIndex !== step.step_index) {
        throw new AntigravityStreamProtocolError(
          'Antigravity emitted an unexpected second user_input step'
        )
      }
      return
    }
    if (!pending.accepted) {
      throw new AntigravityStreamProtocolError(
        'Antigravity work arrived before its user_input echo'
      )
    }
    this.emit({
      type: 'step_update',
      step,
      clientMessageId: pending.clientMessageId,
      requestedAt: pending.requestedAt
    })
  }

  private acceptResult(result: AntigravityStreamResult): void {
    this.assertConversation(result.conversation_id)
    const pending = this.active
    if (!pending) {
      if (result.num_turns <= this.lastTerminalTurns) {
        return
      }
      throw new AntigravityStreamProtocolError(
        'Antigravity emitted a result without an active prompt'
      )
    }
    const terminal = isAntigravityTerminalStatus(result.status)
    const zeroTurnProviderError =
      !this.hasTerminalResult &&
      this.lastTerminalTurns === 0 &&
      result.num_turns === 0 &&
      (result.status === 'ERROR' || result.status === 'INVALID')
    if (terminal && result.num_turns <= this.lastTerminalTurns && !zeroTurnProviderError) {
      return
    }
    if (terminal && result.status === 'SUCCESS' && !pending.accepted) {
      throw new AntigravityStreamProtocolError(
        'Antigravity reported SUCCESS without a user_input echo'
      )
    }
    this.emit({ type: 'result', result, clientMessageId: pending.clientMessageId, terminal })
    if (this.failure.error) {
      return
    }
    if (!terminal) {
      return
    }
    this.lastTerminalTurns = Math.max(this.lastTerminalTurns, result.num_turns)
    this.hasTerminalResult = true
    this.active = null
    pending.resolve(result)
    this.pump()
  }

  private assertConversation(conversationId: string): void {
    if (conversationId !== this.conversationId) {
      throw new AntigravityStreamProtocolError(
        'Antigravity event conversation_id does not match init'
      )
    }
  }

  private emit(event: AntigravityStreamTransportEvent): void {
    try {
      this.options.onEvent(event)
    } catch (error) {
      this.failure.fail(asAntigravityError(error))
    }
  }

  private pump(): void {
    if (
      !this.conversationId ||
      this.failure.error ||
      this.closed ||
      this.active ||
      this.queue.length === 0
    ) {
      return
    }
    const pending = this.queue.shift()!
    pending.requestedAt = Date.now()
    this.active = pending
    const payload = encodeNdjson({ event: 'user', message: { content: pending.message } })
    this.process.child.stdin.write(payload, (error?: Error | null) => {
      if (error) {
        this.failure.fail(error)
      }
    })
  }
}
