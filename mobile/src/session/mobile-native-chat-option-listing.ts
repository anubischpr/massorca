import type { AgentSessionOptionCatalog } from '../../../src/shared/agent-session-option-catalog'
import type { AgentSessionOptionsResult } from '../../../src/shared/agent-session-wire'
import {
  applyStructuredAgentSessionOptions,
  type StructuredAgentSessionOptionState
} from '../../../src/shared/structured-agent-session-options'

/**
 * Whether an options read lists only the seed's built-in entries, apart from the picked model: a
 * fallback sent while the host's listing is pending, not the account's own list.
 */
export function isBuiltInOnlyOptionList(
  result: AgentSessionOptionsResult,
  seed: AgentSessionOptionCatalog
): boolean {
  const builtIn = new Set(seed.models.map((model) => model.id))
  const listed = result.models.filter((model) => model.id !== result.current.model)
  return listed.length > 0 && listed.every((model) => builtIn.has(model.id))
}

/**
 * Applies an options read. A built-in fallback is recorded as `builtin`, not `live`: `live` makes
 * every later host listing a no-op, so a chat opened before the listing landed kept four models.
 */
export function applyStructuredAgentSessionOptionsResult(
  state: StructuredAgentSessionOptionState,
  seed: AgentSessionOptionCatalog,
  result: AgentSessionOptionsResult
): StructuredAgentSessionOptionState {
  const applied = applyStructuredAgentSessionOptions(state, seed, result)
  if (!isBuiltInOnlyOptionList(result, seed)) {
    return applied
  }
  // Why: a fallback never replaces a listing the host has already applied.
  return state.catalogSource === 'host'
    ? { ...applied, catalog: state.catalog, catalogSource: 'host' }
    : { ...applied, catalogSource: 'builtin' }
}
