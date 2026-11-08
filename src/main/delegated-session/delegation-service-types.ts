import type { PrototypeSystemCard } from '../../shared/prototype-design-system-card'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { StructuredAgentSessionHostRows } from '../native-chat/agent-session-wire/structured-agent-session-host-rows'
import type { OrchestrationDb } from '../runtime/orchestration/db'
import type { PiRuntimeSelection } from '../../shared/pi-runtime-selection'
import type {
  DelegationAgentRefusal,
  DelegationStoredAgent,
  DelegationTierAdvisor
} from './delegation-options'

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
  /** Asks this host's meters to refresh when stale; the router reads them afterwards. */
  refreshUsage: () => Promise<void>
  now: () => number
}

export type DelegationRequestDeps = DelegationHostDeps & {
  requireDb: () => OrchestrationDb
  /** Agents registered on this host and usable in the parent's workspace; a Pi runtime named is the one checked. */
  listAgents: (
    parent: DelegationParentSession,
    piRuntime?: PiRuntimeSelection
  ) => Promise<DelegationStoredAgent[]>
  /** The agents registered on this host that cannot start a chat in the parent's workspace, each with its reason. */
  explainRefusals?: (
    parent: DelegationParentSession,
    piRuntime?: PiRuntimeSelection
  ) => Promise<DelegationAgentRefusal[]>
  /** The saved Settings value for the prototype count, unsanitized. */
  readPrototypeCount: () => unknown
  /** The parent chat's project design system as its card shows it; null when it cannot be shown. */
  readDesignSystemCard: (parentSessionId: string) => Promise<PrototypeSystemCard | null>
  /** What the person last typed in the parent chat, or undefined when this host holds no such message. */
  readParentUserMessage: (parentSessionId: string) => Promise<string | undefined>
  adviseTier?: DelegationTierAdvisor
  /** Whether a bot team task runs this chat, so no person is there to answer its cards. */
  isBotRunSession?: (sessionId: string) => boolean
  /** Starts a filed request on the router's choice. */
  startAutomatic?: (requestId: string) => void
}
