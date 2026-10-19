// Antigravity `.system_generated/logs/transcript.jsonl` row → NativeChatMessage decoder.

import type { NativeChatBlock, NativeChatMessage } from '../../shared/native-chat-types'
import { extractAntigravityUserRequest } from '../ai-vault/antigravity-user-request'
import {
  asRecord,
  extractString,
  parseJsonObject,
  timestampMs
} from '../ai-vault/session-scanner-values'

const TOOL_OUTPUT_HEADER_PREFIXES = ['Created At: ', 'Completed At: ']

/**
 * Antigravity rows carry the user's prompt, the model's planner response with its tool calls,
 * and the tool outputs (`GENERIC`). Environment and checkpoint rows are not conversation turns.
 */
export function decodeAntigravityTranscriptLine(
  line: string,
  fallbackId: string
): NativeChatMessage | null {
  const record = parseJsonObject(line)
  if (!record) {
    return null
  }
  const source = extractString(record.source)
  const type = extractString(record.type)
  const timestamp = antigravityTimestamp(record.created_at)

  if ((source === 'USER_EXPLICIT' || source === 'USER') && type === 'USER_INPUT') {
    const text = extractAntigravityUserRequest(extractString(record.content) ?? '')
    if (!text?.trim()) {
      return null
    }
    return {
      id: fallbackId,
      role: 'user',
      blocks: [{ type: 'text', text }],
      timestamp,
      source: 'transcript'
    }
  }

  if (source === 'MODEL' && type === 'PLANNER_RESPONSE') {
    const blocks: NativeChatBlock[] = []
    const text = extractString(record.content)
    if (text?.trim()) {
      blocks.push({ type: 'text', text })
    }
    blocks.push(...antigravityToolCallBlocks(record.tool_calls))
    if (blocks.length === 0) {
      return null
    }
    return { id: fallbackId, role: 'assistant', blocks, timestamp, source: 'transcript' }
  }

  if (source === 'MODEL' && type === 'GENERIC') {
    const output = antigravityToolOutput(extractString(record.content) ?? '')
    const failed = extractString(record.error) !== null || record.status === 'ERROR'
    if (!output && !failed) {
      return null
    }
    return {
      id: fallbackId,
      role: 'tool',
      blocks: [{ type: 'tool-result', output, ...(failed ? { isError: true } : {}) }],
      timestamp,
      source: 'transcript'
    }
  }

  return null
}

function antigravityTimestamp(value: unknown): number | null {
  const ms = timestampMs(value)
  return Number.isFinite(ms) ? ms : null
}

function antigravityToolCallBlocks(value: unknown): NativeChatBlock[] {
  if (!Array.isArray(value)) {
    return []
  }
  const blocks: NativeChatBlock[] = []
  for (const item of value) {
    const call = asRecord(item)
    const name = extractString(call?.name)
    if (!call || !name) {
      continue
    }
    blocks.push({ type: 'tool-call', name, input: unwrapToolArguments(asRecord(call.args)) })
  }
  return blocks
}

/** Antigravity stores string arguments JSON-quoted (`"\"/path\""`); the decoded value is the argument. */
function unwrapToolArguments(args: Record<string, unknown> | null): Record<string, unknown> {
  const unwrapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args ?? {})) {
    unwrapped[key] = unwrapQuotedArgument(value)
  }
  return unwrapped
}

function unwrapQuotedArgument(value: unknown): unknown {
  if (typeof value !== 'string' || value.length < 2 || !value.startsWith('"')) {
    return value
  }
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : value
  } catch {
    return value
  }
}

/** Drops the `Created At` / `Completed At` header the tool runner prefixes to every output. */
function antigravityToolOutput(content: string): string {
  const lines = content.split('\n')
  let start = 0
  while (
    start < lines.length &&
    TOOL_OUTPUT_HEADER_PREFIXES.some((prefix) => lines[start]?.startsWith(prefix))
  ) {
    start += 1
  }
  return lines.slice(start).join('\n').trim()
}
