export type AntigravityStreamUsage = {
  input_tokens?: number
  output_tokens?: number
  thinking_tokens?: number
  cache_read_tokens?: number
  total_tokens?: number
}

/** ACTIVE and DONE are the wire names; FAILED covers error, failed and canceled names; UNKNOWN is any other state. */
export type AntigravityStreamStepState = 'ACTIVE' | 'DONE' | 'FAILED' | 'UNKNOWN'

export type AntigravityStreamStepUpdate = {
  conversation_id: string
  step_index: number
  state: AntigravityStreamStepState
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

export class AntigravityStreamProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AntigravityStreamProtocolError'
  }
}

/** Key names and value types only, never values: what a support report may carry about a frame. */
export type AntigravityFrameFieldKinds = Readonly<Record<string, string>>

/** A step frame that could not be read. It is unclassified, so the session keeps running. */
export class AntigravityStreamStepFrameError extends AntigravityStreamProtocolError {
  constructor(
    readonly field: string,
    readonly fieldKinds: AntigravityFrameFieldKinds
  ) {
    super(`Antigravity step_update has invalid fields: ${field}`)
    this.name = 'AntigravityStreamStepFrameError'
  }
}

export type AntigravityStreamWireRecord =
  | { event: 'init'; conversation_id: string }
  | { event: 'step_update'; step_update: AntigravityStreamStepUpdate }
  | { event: 'result'; result: AntigravityStreamResult }
  | { event: 'unknown'; eventName: string }

const USAGE_KEYS = [
  'input_tokens',
  'output_tokens',
  'thinking_tokens',
  'cache_read_tokens',
  'total_tokens'
] as const

const ACTIVE_STEP_STATES = new Set([
  'ACTIVE',
  'RUNNING',
  'IN_PROGRESS',
  'PENDING',
  'WAITING',
  'STARTED'
])
const DONE_STEP_STATES = new Set([
  'DONE',
  'COMPLETED',
  'COMPLETE',
  'SUCCEEDED',
  'SUCCESS',
  'FINISHED'
])
const FAILED_STEP_STATE = /ERROR|FAIL|CANCEL|INTERRUPT|DENIED|INVALID|ABORT|TIMEOUT|REJECT/

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
}

function describeFrameValue(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  return Array.isArray(value) ? 'array' : typeof value
}

/** The key names and value types of a frame object, without any of its values. */
export function describeAntigravityFrameFieldKinds(value: unknown): AntigravityFrameFieldKinds {
  if (!isObject(value)) {
    return { value: describeFrameValue(value) }
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, describeFrameValue(entry)])
  )
}

function stepFrameError(
  field: string,
  fieldKinds: AntigravityFrameFieldKinds
): AntigravityStreamStepFrameError {
  return new AntigravityStreamStepFrameError(field, fieldKinds)
}

function parseUsage(value: unknown): AntigravityStreamUsage | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!isObject(value)) {
    throw new AntigravityStreamProtocolError('Antigravity usage must be an object')
  }
  const usage: AntigravityStreamUsage = {}
  for (const key of USAGE_KEYS) {
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

/** Step usage is advisory: null counts are absent, and a malformed count fails only its step frame. */
function parseStepUsage(
  value: unknown,
  fieldKinds: AntigravityFrameFieldKinds
): AntigravityStreamUsage | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isObject(value)) {
    throw stepFrameError('usage', fieldKinds)
  }
  const usage: AntigravityStreamUsage = {}
  for (const key of USAGE_KEYS) {
    const count = value[key]
    if (count === undefined || count === null) {
      continue
    }
    if (!isNonNegativeNumber(count)) {
      throw stepFrameError(`usage.${key}`, fieldKinds)
    }
    usage[key] = count
  }
  return usage
}

function optionalStepString(
  value: Record<string, unknown>,
  field: string,
  fieldKinds: AntigravityFrameFieldKinds
): string | undefined {
  const entry = value[field]
  if (entry === undefined || entry === null) {
    return undefined
  }
  if (typeof entry !== 'string') {
    throw stepFrameError(field, fieldKinds)
  }
  return entry
}

function optionalStepDuration(
  value: Record<string, unknown>,
  fieldKinds: AntigravityFrameFieldKinds
): number | undefined {
  const entry = value.duration_seconds
  if (entry === undefined || entry === null) {
    return undefined
  }
  if (!isNonNegativeNumber(entry)) {
    throw stepFrameError('duration_seconds', fieldKinds)
  }
  return entry
}

/** Maps a wire state name onto the step lifecycle; any name, string or not, parses, and unknown names stay UNKNOWN. */
export function classifyAntigravityStepState(value: unknown): AntigravityStreamStepState {
  if (typeof value !== 'string') {
    return 'UNKNOWN'
  }
  const name = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  if (FAILED_STEP_STATE.test(name)) {
    return 'FAILED'
  }
  if (ACTIVE_STEP_STATES.has(name)) {
    return 'ACTIVE'
  }
  if (DONE_STEP_STATES.has(name)) {
    return 'DONE'
  }
  return 'UNKNOWN'
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

function parseStepUpdate(value: unknown): AntigravityStreamStepUpdate {
  if (!isObject(value)) {
    throw stepFrameError('step_update', describeAntigravityFrameFieldKinds(value))
  }
  const fieldKinds = describeAntigravityFrameFieldKinds(value)
  if (typeof value.conversation_id !== 'string' || value.conversation_id.length === 0) {
    throw stepFrameError('conversation_id', fieldKinds)
  }
  if (!isSafeNonNegativeInteger(value.step_index)) {
    throw stepFrameError('step_index', fieldKinds)
  }
  if (typeof value.step_type !== 'string' || value.step_type.length === 0) {
    throw stepFrameError('step_type', fieldKinds)
  }
  const textDelta = optionalStepString(value, 'text_delta', fieldKinds)
  const toolName = optionalStepString(value, 'tool_name', fieldKinds)
  const durationSeconds = optionalStepDuration(value, fieldKinds)
  const usage = parseStepUsage(value.usage, fieldKinds)
  return {
    conversation_id: value.conversation_id,
    step_index: value.step_index,
    state: classifyAntigravityStepState(value.state),
    step_type: value.step_type,
    ...(textDelta === undefined ? {} : { text_delta: textDelta }),
    ...(toolName === undefined ? {} : { tool_name: toolName }),
    ...(value.tool_info === undefined ? {} : { tool_info: value.tool_info }),
    ...(durationSeconds === undefined ? {} : { duration_seconds: durationSeconds }),
    ...(usage ? { usage } : {})
  }
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
    return { event: 'step_update', step_update: parseStepUpdate(value.step_update) }
  }
  if (value.event === 'result') {
    const result = value.result
    if (
      !isObject(result) ||
      typeof result.conversation_id !== 'string' ||
      result.conversation_id.length === 0 ||
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
