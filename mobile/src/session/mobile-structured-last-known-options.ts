// Each structured chat's newest options answer, kept so a reseeded view does not blank.
import type { AgentSessionOptionCatalog } from '../../../src/shared/agent-session-option-catalog'
import type { AgentSessionOptionsResult } from '../../../src/shared/agent-session-wire'
import {
  createStructuredAgentSessionOptionState,
  type StructuredAgentSessionOptionState
} from '../../../src/shared/structured-agent-session-options'
import { applyStructuredAgentSessionOptionsResult } from './mobile-native-chat-option-listing'

const LAST_KNOWN_LIMIT = 32

const lastKnown = new Map<string, AgentSessionOptionsResult>()

/** Remembers a chat's newest answer, dropping the least recently answered past the limit. */
export function rememberMobileStructuredLastKnownOptions(
  key: string,
  result: AgentSessionOptionsResult
): void {
  lastKnown.delete(key)
  lastKnown.set(key, result)
  for (const oldest of lastKnown.keys()) {
    if (lastKnown.size <= LAST_KNOWN_LIMIT) {
      break
    }
    lastKnown.delete(oldest)
  }
}

/** The seed state for a chat, with the answer it last showed applied when one is remembered. */
export function seedStructuredOptionsFromLastKnown(args: {
  agent: string
  catalog: AgentSessionOptionCatalog | null
  key: string
}): { state: StructuredAgentSessionOptionState; answered: boolean } {
  const seeded = createStructuredAgentSessionOptionState(args.agent, args.catalog)
  const answer = lastKnown.get(args.key)
  if (!answer || !args.catalog) {
    return { state: seeded, answered: false }
  }
  return {
    state: applyStructuredAgentSessionOptionsResult(seeded, args.catalog, answer),
    answered: true
  }
}

export function clearMobileStructuredLastKnownOptionsForTests(): void {
  lastKnown.clear()
}
