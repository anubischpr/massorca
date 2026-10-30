import {
  buildPrototypeListGroups,
  type PrototypeListGroup
} from '../../../src/shared/prototype-list-groups'
import {
  PROTOTYPE_AGENT_NAMES,
  PROTOTYPE_FILTERS,
  buildPrototypeListRows,
  type PrototypeFilter,
  type PrototypeListRow,
  type PrototypeStatus
} from '../../../src/shared/prototype-list-model'
import {
  activePrototypeSets,
  archivedPrototypeSets
} from '../../../src/shared/prototype-archived-sets'
import type { PrototypeAgent } from '../../../src/shared/prototype-request'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'

/** The list shows the sets of the chat it was opened from, or of every agent's chats. */
export type MobilePrototypeScope = 'chat' | 'all'

export const MOBILE_PROTOTYPE_FILTERS = PROTOTYPE_FILTERS

const FILTER_LABELS: Readonly<Record<PrototypeFilter, string>> = {
  all: 'All',
  claude: 'Claude',
  codex: 'Codex',
  antigravity: 'Stitch',
  'gentle-shell': 'Gentle Shell'
}

export function mobilePrototypeFilterLabel(filter: PrototypeFilter): string {
  return FILTER_LABELS[filter]
}

export function mobilePrototypeAgentLabel(agent: PrototypeAgent): string {
  return PROTOTYPE_AGENT_NAMES[agent]
}

export function mobilePrototypeStatusLabel(status: PrototypeStatus): string {
  return status.kind === 'single'
    ? '1 screen'
    : `${status.count} directions · iterating ${status.iterating}`
}

/** The status line of a set row: its directions, then the design system version it was built on. */
export function mobilePrototypeRowStatusLine(row: PrototypeListRow): string {
  const status = mobilePrototypeStatusLabel(row.status)
  const { builtOn } = row.set
  return builtOn === undefined ? status : `${status} · built on v${builtOn}`
}

/** The second line of a project's Design system row. */
export function mobilePrototypeSystemLine(
  system: Pick<PrototypeListedDesignSystem, 'status' | 'version' | 'tokenCount'>
): string {
  return system.status === 'proposed'
    ? 'Proposed · needs review'
    : `Detected · v${system.version} · ${system.tokenCount} tokens`
}

/** The sets of one chat; with no chat to name, the scope shows every set. */
export function mobilePrototypeSetsInScope(
  sets: readonly PrototypeListedSet[],
  scope: MobilePrototypeScope,
  sessionId: string | null
): PrototypeListedSet[] {
  return scope === 'chat' && sessionId !== null
    ? sets.filter((set) => set.sessionId === sessionId)
    : [...sets]
}

export function buildMobilePrototypeRows(input: {
  sets: readonly PrototypeListedSet[]
  scope: MobilePrototypeScope
  sessionId: string | null
  filter: PrototypeFilter
  activeLetterOf: (requestId: string) => string | undefined
  nowMs: number
}): PrototypeListRow[] {
  return buildPrototypeListRows({
    sets: mobilePrototypeSetsInScope(input.sets, input.scope, input.sessionId),
    filter: input.filter,
    activeLetterOf: input.activeLetterOf,
    nowMs: input.nowMs
  })
}

/** The menu's count: the sets of this chat, archived ones left out. */
export function mobilePrototypeMenuCount(
  sets: readonly PrototypeListedSet[],
  sessionId: string | null
): number {
  return sessionId === null
    ? 0
    : activePrototypeSets(sets).filter((set) => set.sessionId === sessionId).length
}

/** The rows of the Archived group, at the end of the list: the archived sets in this scope and filter. */
export function buildMobilePrototypeArchivedRows(input: {
  sets: readonly PrototypeListedSet[]
  scope: MobilePrototypeScope
  sessionId: string | null
  filter: PrototypeFilter
  activeLetterOf: (requestId: string) => string | undefined
  nowMs: number
}): PrototypeListRow[] {
  return buildMobilePrototypeRows({ ...input, sets: archivedPrototypeSets(input.sets) })
}

/**
 * The list grouped by project, each group with its pinned design system row. "This chat" keeps the
 * projects of that chat's sets, and a project whose proposal waits in that chat.
 */
export function buildMobilePrototypeGroups(input: {
  sets: readonly PrototypeListedSet[]
  designSystems: readonly PrototypeListedDesignSystem[]
  scope: MobilePrototypeScope
  sessionId: string | null
  filter: PrototypeFilter
  activeLetterOf: (requestId: string) => string | undefined
  nowMs: number
}): PrototypeListGroup[] {
  // Why: archived sets leave the groups and what they count; the Archived group lists them.
  const active = activePrototypeSets(input.sets)
  const scoped = mobilePrototypeSetsInScope(active, input.scope, input.sessionId)
  const chatOnly = input.scope === 'chat' && input.sessionId !== null
  const projectKeys = new Set(
    scoped.flatMap((set) => (set.projectKey === undefined ? [] : [set.projectKey]))
  )
  return buildPrototypeListGroups({
    sets: scoped,
    rows: buildMobilePrototypeRows({ ...input, sets: active }),
    designSystems: chatOnly
      ? input.designSystems.filter(
          (system) =>
            projectKeys.has(system.projectKey) ||
            system.pendingRequest?.sessionId === input.sessionId
        )
      : input.designSystems
  })
}
