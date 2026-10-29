import {
  PROTOTYPE_AGENT_NAMES,
  PROTOTYPE_FILTERS,
  buildPrototypeListRows,
  type PrototypeFilter,
  type PrototypeListRow,
  type PrototypeStatus
} from '../../../src/shared/prototype-list-model'
import type { PrototypeAgent } from '../../../src/shared/prototype-request'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'

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

/** The menu's count: the sets of this chat. */
export function mobilePrototypeMenuCount(
  sets: readonly PrototypeListedSet[],
  sessionId: string | null
): number {
  return sessionId === null ? 0 : sets.filter((set) => set.sessionId === sessionId).length
}
