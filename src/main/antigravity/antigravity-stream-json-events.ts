import {
  boundPayload,
  DEFAULT_JOURNAL_PAYLOAD_LIMITS
} from '../native-chat/agent-session-journal/journal-payload-bounds'
import type { ProviderTimelineEvent } from '../native-chat/agent-session-timeline/provider-timeline-event'
import type { AntigravityStreamTransportEvent } from './antigravity-stream-json-transport'

type ProjectedTool = {
  item: string
  name: string
  input: unknown
  callId: string
}

/** Converts validated Antigravity stream events into the shared timeline grammar. */
export class AntigravityStreamEventProjector {
  private conversationId: string | null = null
  private activeClientMessageId: string | null = null
  private requestedAt = 0
  private turnOpen = false
  private streamedText = false
  private readonly accepted = new Set<string>()
  private readonly completed = new Set<string>()
  private readonly tools = new Map<number, ProjectedTool>()

  constructor(private readonly now: () => number = Date.now) {}

  apply(event: AntigravityStreamTransportEvent): ProviderTimelineEvent[] {
    if (event.type === 'initialized') {
      if (this.conversationId && this.conversationId !== event.conversationId) {
        throw new Error('Antigravity projector received a second conversation identity')
      }
      this.conversationId = event.conversationId
      return []
    }
    if (!this.conversationId) {
      throw new Error('Antigravity projector received data before initialization')
    }
    if (event.type === 'step_update') {
      return this.projectStep(event)
    }
    return this.projectResult(event)
  }

  private projectStep(
    event: Extract<AntigravityStreamTransportEvent, { type: 'step_update' }>
  ): ProviderTimelineEvent[] {
    const { step, clientMessageId } = event
    this.assertConversation(step.conversation_id)
    if (step.step_type === 'user_input') {
      if (this.completed.has(clientMessageId) || this.accepted.has(clientMessageId)) {
        return []
      }
      if (this.activeClientMessageId && this.activeClientMessageId !== clientMessageId) {
        throw new Error('Antigravity echoed a new input before the active turn ended')
      }
      this.activeClientMessageId = clientMessageId
      this.requestedAt = event.requestedAt
      this.accepted.add(clientMessageId)
      return [{ type: 'input.accepted', clientMessageId, requestedAt: event.requestedAt }]
    }
    this.assertActive(clientMessageId)
    const events: ProviderTimelineEvent[] = []
    if (step.step_type === 'agent_response' || step.step_type === 'tool') {
      this.ensureTurnOpen(events)
    }
    if (step.step_type === 'agent_response' && step.text_delta) {
      this.streamedText = true
      events.push({
        type: 'text.delta',
        item: { stream: this.responseStreamId(clientMessageId) },
        channel: 'assistant',
        text: step.text_delta
      })
    }
    if (step.step_type === 'tool') {
      events.push(
        ...this.projectTool(
          step.step_index,
          step.tool_name,
          step.tool_info,
          step.state,
          clientMessageId
        )
      )
    }
    return events
  }

  private projectTool(
    stepIndex: number,
    declaredName: string | undefined,
    rawInfo: unknown,
    state: 'ACTIVE' | 'DONE',
    clientMessageId: string
  ): ProviderTimelineEvent[] {
    const info = isObject(rawInfo) ? rawInfo : null
    const name = declaredName ?? (typeof info?.name === 'string' ? info.name : undefined)
    if (!name) {
      return [
        { type: 'provider.frame', frameKind: 'tool.unclassified', payload: { stepIndex, rawInfo } }
      ]
    }
    const existing = this.tools.get(stepIndex)
    const tool: ProjectedTool = existing ?? {
      item: `antigravity:${this.conversationId}:tool:${clientMessageId}:${stepIndex}`,
      name,
      input: info?.parameters ?? null,
      callId: String(stepIndex)
    }
    const failed = info?.error !== undefined && info.error !== null
    const shown = failed ? info.error : info?.output
    const body = {
      kind: 'tool-call' as const,
      name: tool.name,
      callId: String(stepIndex),
      input: tool.input,
      state:
        state === 'ACTIVE'
          ? ('running' as const)
          : failed
            ? ('failed' as const)
            : ('completed' as const),
      ...(shown === undefined || shown === null
        ? {}
        : { output: boundPayload(toolOutputText(shown), DEFAULT_JOURNAL_PAYLOAD_LIMITS) })
    }
    const events: ProviderTimelineEvent[] = []
    if (state === 'ACTIVE') {
      this.tools.set(stepIndex, tool)
      events.push(
        existing
          ? { type: 'item.update', item: tool.item, body }
          : { type: 'item.open', item: tool.item, body }
      )
    } else {
      this.tools.delete(stepIndex)
      events.push({ type: 'item.close', item: tool.item, body })
    }
    if (failed) {
      events.push({
        type: 'provider.frame',
        frameKind: 'tool.error',
        payload: { stepIndex, toolName: name, error: info.error }
      })
    } else if (info?.output !== undefined) {
      events.push({
        type: 'provider.frame',
        frameKind: 'tool.output',
        payload: { stepIndex, toolName: name, output: info.output }
      })
    }
    return events
  }

  private projectResult(
    event: Extract<AntigravityStreamTransportEvent, { type: 'result' }>
  ): ProviderTimelineEvent[] {
    const { result, clientMessageId } = event
    this.assertConversation(result.conversation_id)
    if (!event.terminal || this.completed.has(clientMessageId)) {
      return []
    }
    if (this.activeClientMessageId !== clientMessageId) {
      if (!this.accepted.has(clientMessageId)) {
        this.completed.add(clientMessageId)
        return [
          {
            type: 'provider.frame',
            frameKind: 'result.error',
            payload: { status: result.status, error: result.error ?? result.response }
          }
        ]
      }
      throw new Error('Antigravity result does not match the active client turn')
    }

    const events: ProviderTimelineEvent[] = []
    this.ensureTurnOpen(events)
    const endedAs =
      result.status === 'CANCELED' || result.status === 'INTERRUPTED'
        ? 'interrupted'
        : 'unverifiable'
    for (const tool of this.tools.values()) {
      events.push({
        type: 'item.close',
        item: tool.item,
        body: {
          kind: 'tool-call',
          name: tool.name,
          callId: tool.callId,
          input: tool.input,
          state: 'failed',
          endedAs
        }
      })
    }
    this.tools.clear()
    if (this.streamedText) {
      events.push({
        type: 'text.close',
        item: { stream: this.responseStreamId(clientMessageId) },
        text: result.response
      })
    } else if (result.response.length > 0) {
      const item = this.responseItemId(clientMessageId)
      const body = {
        kind: 'message' as const,
        role: 'assistant' as const,
        state: 'completed' as const,
        blocks: [{ type: 'text' as const, text: result.response }]
      }
      events.push({ type: 'item.open', item, body }, { type: 'item.close', item, body })
    }
    if (result.usage) {
      events.push({
        type: 'provider.frame',
        frameKind: 'usage.cumulative',
        payload: { scope: 'conversation', num_turns: result.num_turns, usage: result.usage }
      })
    }
    if (result.status === 'ERROR' || result.status === 'INVALID' || !isKnownStatus(result.status)) {
      events.push({
        type: 'provider.frame',
        frameKind: 'result.error',
        payload: { status: result.status, error: result.error ?? result.response }
      })
    }
    events.push({
      type: 'turn.end',
      at: this.now(),
      state:
        result.status === 'CANCELED' || result.status === 'INTERRUPTED'
          ? 'interrupted'
          : 'completed',
      ...(result.status === 'SUCCESS'
        ? { outcome: 'success' as const }
        : result.status === 'CANCELED'
          ? { outcome: 'cancellation' as const }
          : result.status === 'ERROR' ||
              result.status === 'INVALID' ||
              !isKnownStatus(result.status)
            ? { outcome: 'failure' as const }
            : {}),
      ...(result.duration_seconds === undefined
        ? {}
        : { durationMs: Math.round(result.duration_seconds * 1000) })
    })
    this.completed.add(clientMessageId)
    this.activeClientMessageId = null
    this.turnOpen = false
    this.streamedText = false
    this.requestedAt = 0
    return events
  }

  private ensureTurnOpen(events: ProviderTimelineEvent[]): void {
    if (this.turnOpen) {
      return
    }
    this.turnOpen = true
    events.push({ type: 'turn.open', at: this.requestedAt || this.now() })
  }

  private assertActive(clientMessageId: string): void {
    if (this.activeClientMessageId !== clientMessageId || !this.accepted.has(clientMessageId)) {
      throw new Error('Antigravity step does not match an accepted active input')
    }
  }

  private assertConversation(conversationId: string): void {
    if (conversationId !== this.conversationId) {
      throw new Error('Antigravity projector rejected a mismatched conversation identity')
    }
  }

  private responseStreamId(clientMessageId: string): string {
    return `antigravity:${this.conversationId}:response:${clientMessageId}`
  }

  private responseItemId(clientMessageId: string): string {
    return `antigravity:${this.conversationId}:message:${clientMessageId}`
  }
}

/** The text a tool row shows: a string as is, an error's message, else the value as JSON. */
function toolOutputText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (isObject(value) && typeof value.message === 'string') {
    return value.message
  }
  return JSON.stringify(value) ?? String(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isKnownStatus(status: string): boolean {
  return ['SUCCESS', 'ERROR', 'CANCELED', 'INTERRUPTED', 'INVALID'].includes(status)
}
