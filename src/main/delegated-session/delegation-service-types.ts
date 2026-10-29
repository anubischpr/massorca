import type { RateLimitState } from '../../shared/rate-limit-types'
import type { StructuredAgentSessionHostRows } from '../native-chat/agent-session-wire/structured-agent-session-host-rows'
import type { OrchestrationDb } from '../runtime/orchestration/db'
import type { DelegationStoredAgent } from './delegation-options'

/** The parent chat as a delegation request reads it. */
export type DelegationParentSession = {
  sessionId: string
  /** The parent's agent, which breaks a usage tie. */
  agent: string
  workspaceId: string
  workspaceKind: 'git' | 'folder'
  /** The parent's access option as recorded; absent when it follows the global setting. */
  accessMode: string | undefined
}

/** What every delegation step reads of the host. */
export type DelegationHostDeps = {
  /** The orchestration database when it exists; null for a profile that has none. */
  getDb: () => OrchestrationDb | null
  rows: StructuredAgentSessionHostRows
  readParent: (sessionId: string) => DelegationParentSession | null
  readRateLimits: () => RateLimitState | null
  now: () => number
}

export type DelegationRequestDeps = DelegationHostDeps & {
  requireDb: () => OrchestrationDb
  /** Agents registered on this host and usable in the parent's workspace. */
  listAgents: (parent: DelegationParentSession) => Promise<DelegationStoredAgent[]>
}
