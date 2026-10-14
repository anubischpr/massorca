import {
  commitStructuredAgentSessionOption,
  type StructuredAgentSessionOptionState
} from './structured-agent-session-options'
import { STRUCTURED_LAUNCH_SEED_OPTION_IDS } from './native-chat-session-option-defaults'

export function commitStructuredAgentSessionOptionValues(
  state: StructuredAgentSessionOptionState,
  values: Readonly<Record<string, string>>
): StructuredAgentSessionOptionState {
  let next = state
  for (const id of STRUCTURED_LAUNCH_SEED_OPTION_IDS) {
    const value = values[id]
    if (value !== undefined) {
      next = commitStructuredAgentSessionOption(next, id, value)
    }
  }
  return next
}
