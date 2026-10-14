export type AntigravityStreamUsage = {
  input_tokens?: number
  output_tokens?: number
  thinking_tokens?: number
  cache_read_tokens?: number
  total_tokens?: number
}

export type AntigravityStreamStepUpdate = {
  conversation_id: string
  step_index: number
  state: 'ACTIVE' | 'DONE'
  step_type: string
  text_delta?: string
  tool_name?: string
  tool_info?: unknown
  duration_seconds?: number
  usage?: AntigravityStreamUsage
}

export type AntigravityStreamResult = {
  conversation_id: string
  status: AntigravityStreamStatus
  response: string
  error?: string
  num_turns: number
  duration_seconds?: number
  usage?: AntigravityStreamUsage
}

export type AntigravityStreamStatus =
  | 'SUCCESS'
  | 'ERROR'
  | 'CANCELED'
  | 'INTERRUPTED'
  | 'INVALID'
  | 'WAITING'
  | 'RUNNING'

export type AntigravityStreamTransportEvent =
  | { type: 'initialized'; conversationId: string }
  | {
      type: 'step_update'
      step: AntigravityStreamStepUpdate
      clientMessageId: string
      requestedAt: number
    }
  | {
      type: 'result'
      result: AntigravityStreamResult
      clientMessageId: string
      terminal: boolean
    }

export class AntigravityStreamProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AntigravityStreamProtocolError'
  }
}

export type AntigravityStreamWireRecord =
  | { event: 'init'; conversation_id: string }
  | { event: 'step_update'; step_update: AntigravityStreamStepUpdate }
  | { event: 'result'; result: AntigravityStreamResult }
  | { event: 'unknown'; eventName: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
}

function parseUsage(value: unknown): AntigravityStreamUsage | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!isObject(value)) {
    throw new AntigravityStreamProtocolError('Antigravity usage must be an object')
  }
  const usage: AntigravityStreamUsage = {}
  for (const key of [
    'input_tokens',
    'output_tokens',
    'thinking_tokens',
    'cache_read_tokens',
    'total_tokens'
  ] as const) {
    const count = value[key]
    if (count !== undefined) {
      if (!isNonNegativeNumber(count)) {
        throw new AntigravityStreamProtocolError(`Antigravity usage.${key} must be non-negative`)
      }
      usage[key] = count
    }
  }
  return usage
}

function isStatus(value: unknown): value is AntigravityStreamStatus {
  return (
    value === 'SUCCESS' ||
    value === 'ERROR' ||
    value === 'CANCELED' ||
    value === 'INTERRUPTED' ||
    value === 'INVALID' ||
    value === 'WAITING' ||
    value === 'RUNNING'
  )
}

export function isAntigravityTerminalStatus(status: AntigravityStreamStatus): boolean {
  return status !== 'WAITING' && status !== 'RUNNING'
}

export function parseAntigravityStreamRecord(value: unknown): AntigravityStreamWireRecord {
  if (!isObject(value) || typeof value.event !== 'string') {
    throw new AntigravityStreamProtocolError('Antigravity stream record must name an event')
  }
  if (value.event === 'init') {
    if (typeof value.conversation_id !== 'string' || value.conversation_id.length === 0) {
      throw new AntigravityStreamProtocolError('Antigravity init is missing conversation_id')
    }
    return { event: 'init', conversation_id: value.conversation_id }
  }
  if (value.event === 'step_update') {
    const step = value.step_update
    if (
      !isObject(step) ||
      typeof step.conversation_id !== 'string' ||
      !isSafeNonNegativeInteger(step.step_index) ||
      (step.state !== 'ACTIVE' && step.state !== 'DONE') ||
      typeof step.step_type !== 'string' ||
      step.step_type.length === 0 ||
      (step.text_delta !== undefined && typeof step.text_delta !== 'string') ||
      (step.tool_name !== undefined && typeof step.tool_name !== 'string') ||
      (step.duration_seconds !== undefined && !isNonNegativeNumber(step.duration_seconds))
    ) {
      throw new AntigravityStreamProtocolError('Antigravity step_update has invalid fields')
    }
    const usage = parseUsage(step.usage)
    return {
      event: 'step_update',
      step_update: {
        conversation_id: step.conversation_id,
        step_index: step.step_index,
        state: step.state,
        step_type: step.step_type,
        ...(typeof step.text_delta === 'string' ? { text_delta: step.text_delta } : {}),
        ...(typeof step.tool_name === 'string' ? { tool_name: step.tool_name } : {}),
        ...(step.tool_info === undefined ? {} : { tool_info: step.tool_info }),
        ...(typeof step.duration_seconds === 'number'
          ? { duration_seconds: step.duration_seconds }
          : {}),
        ...(usage ? { usage } : {})
      }
    }
  }
  if (value.event === 'result') {
    const result = value.result
    if (
      !isObject(result) ||
      typeof result.conversation_id !== 'string' ||
      !isStatus(result.status) ||
      typeof result.response !== 'string' ||
      !isSafeNonNegativeInteger(result.num_turns) ||
      (result.error !== undefined && typeof result.error !== 'string') ||
      (result.duration_seconds !== undefined && !isNonNegativeNumber(result.duration_seconds))
    ) {
      throw new AntigravityStreamProtocolError('Antigravity result has invalid fields')
    }
    const usage = parseUsage(result.usage)
    return {
      event: 'result',
      result: {
        conversation_id: result.conversation_id,
        status: result.status,
        response: result.response,
        num_turns: result.num_turns,
        ...(typeof result.error === 'string' ? { error: result.error } : {}),
        ...(typeof result.duration_seconds === 'number'
          ? { duration_seconds: result.duration_seconds }
          : {}),
        ...(usage ? { usage } : {})
      }
    }
  }
  return { event: 'unknown', eventName: value.event }
}
