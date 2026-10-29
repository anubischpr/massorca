import {
  AI_VAULT_AGENTS,
  type AiVaultAgent,
  type AiVaultGroup,
  type AiVaultSearchSort,
  type AiVaultSort
} from '../../../../shared/ai-vault-types'
import { DEFAULT_AI_VAULT_SESSION_LIMIT, type AiVaultSessionLimit } from './ai-vault-session-limit'

// Why: hide-empty used to default true; keep initial state, badge count, and Reset view
// on one constant so a default flip cannot leave Reset pointing at the old value.
export const DEFAULT_AI_VAULT_HIDE_EMPTY_SESSIONS = false
export const DEFAULT_AI_VAULT_SORT: AiVaultSort = 'updated'
export const DEFAULT_AI_VAULT_SEARCH_SORT: AiVaultSearchSort = 'relevance'
export const DEFAULT_AI_VAULT_GROUP: AiVaultGroup = 'project'
// Why: automated runs are noise until asked for, so the list opens on the user's own sessions.
export const DEFAULT_AI_VAULT_SHOW_AUTOMATED_RUNS = false

// Sorts and the automated-runs switch are uncounted: the panel shows them, so neither is hidden.
export function countAiVaultViewAdjustments(options: {
  agents: readonly AiVaultAgent[]
  group: AiVaultGroup
  hideEmptySessions: boolean
  sessionLimit: AiVaultSessionLimit
}): number {
  // Why: count by membership, not length — an agent swap keeps the array length but
  // still deviates from the default of every agent enabled.
  const allAgentsEnabled = AI_VAULT_AGENTS.every((agent) => options.agents.includes(agent))
  return (
    (allAgentsEnabled ? 0 : 1) +
    (options.group === DEFAULT_AI_VAULT_GROUP ? 0 : 1) +
    (options.hideEmptySessions === DEFAULT_AI_VAULT_HIDE_EMPTY_SESSIONS ? 0 : 1) +
    (options.sessionLimit === DEFAULT_AI_VAULT_SESSION_LIMIT ? 0 : 1)
  )
}
