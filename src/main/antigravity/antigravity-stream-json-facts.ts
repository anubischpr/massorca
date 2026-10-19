import type { AgentJournalBoundedPayload } from '../../shared/agent-session-journal-types'
import type { AgentSessionContextUsed } from '../../shared/agent-session-context-usage'
import {
  boundPayload,
  DEFAULT_JOURNAL_PAYLOAD_LIMITS
} from '../native-chat/agent-session-journal/journal-payload-bounds'
import type { AntigravityStreamUsage } from './antigravity-stream-json-protocol'

/** What a tool row shows: a string as is, an error's message, else the value as JSON. */
export function antigravityToolOutput(value: unknown): AgentJournalBoundedPayload {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'object' &&
          value !== null &&
          'message' in value &&
          typeof value.message === 'string'
        ? value.message
        : (JSON.stringify(value) ?? String(value))
  return boundPayload(text, DEFAULT_JOURNAL_PAYLOAD_LIMITS)
}

/** A token count with no window: agy reports none, so none is invented. */
export function antigravityTokenCount(
  usage: AntigravityStreamUsage,
  capturedAt: number
): AgentSessionContextUsed | null {
  const output = (usage.output_tokens ?? 0) + (usage.thinking_tokens ?? 0)
  const cacheRead = usage.cache_read_tokens ?? 0
  // Only a total says anything when agy sent no input split.
  const input = usage.input_tokens ?? (cacheRead + output === 0 ? (usage.total_tokens ?? 0) : 0)
  if (input + cacheRead + output === 0) {
    return null
  }
  return {
    kind: 'estimate',
    usage: {
      inputTokens: input,
      outputTokens: output,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: cacheRead
    },
    capturedAt
  }
}
