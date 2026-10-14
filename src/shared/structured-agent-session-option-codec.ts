import type { SessionOptionValue } from './native-chat-session-options'
import { isAgentSessionAccessModeValue } from './agent-session-access-mode'

const STRUCTURED_BOOLEAN_OPTION_IDS = new Set(['fastMode'])

export function encodeStructuredAgentSessionOptionValue(
  optionId: string,
  value: SessionOptionValue
): string | null {
  if (optionId === 'accessMode') {
    return typeof value === 'string' && isAgentSessionAccessModeValue(value) ? value : null
  }
  if (STRUCTURED_BOOLEAN_OPTION_IDS.has(optionId)) {
    return typeof value === 'boolean' ? String(value) : null
  }
  return typeof value === 'string' ? value : null
}

export function decodeStructuredAgentSessionOptionValue(
  optionId: string,
  value: string
): SessionOptionValue | null {
  if (optionId === 'accessMode') {
    return isAgentSessionAccessModeValue(value) ? value : null
  }
  if (!STRUCTURED_BOOLEAN_OPTION_IDS.has(optionId)) {
    return value
  }
  return value === 'true' ? true : value === 'false' ? false : null
}
