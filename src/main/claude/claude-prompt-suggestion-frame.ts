import type { StructuredAgentSessionPromptSuggestion } from '../native-chat/agent-session-wire/structured-agent-session-event-sink-prompt-suggestion'

/**
 * Claude's `prompt_suggestion` frame as the ephemeral suggestion it publishes, or null to clear.
 * The frame follows the turn's result, when no turn is open, so it names the last one that was.
 */
export function claudePromptSuggestion(
  message: Record<string, unknown>,
  lastTurnId: string | null
): StructuredAgentSessionPromptSuggestion | null {
  const text = typeof message.suggestion === 'string' ? message.suggestion.trim() : ''
  const turnId = lastTurnId ?? (typeof message.uuid === 'string' ? message.uuid : null)
  return text && turnId !== null ? { turnId, text } : null
}
