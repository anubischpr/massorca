import type { PrototypeAgent } from '../../../../shared/prototype-request'
import type {
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'

export const PROTOTYPE_FILTERS = ['all', 'claude', 'codex', 'antigravity', 'gentle-shell'] as const

export type PrototypeFilter = (typeof PROTOTYPE_FILTERS)[number]

const FILTER_AGENT: Readonly<Record<Exclude<PrototypeFilter, 'all'>, PrototypeAgent>> = {
  claude: 'claude',
  codex: 'codex',
  antigravity: 'antigravity',
  'gentle-shell': 'gentle-shell'
}

const TITLE_WORD_LIMIT = 6
const TITLE_MAX_LENGTH = 60

const AGENT_MONO: Readonly<Record<PrototypeAgent, string>> = {
  claude: 'CL',
  codex: 'CX',
  antigravity: 'ST',
  'gentle-shell': 'GS',
  other: 'OT'
}

/** English names; the screen translates them with the same keys as the agent label. */
export const PROTOTYPE_AGENT_NAMES: Readonly<Record<PrototypeAgent, string>> = {
  claude: 'Claude',
  codex: 'Codex',
  antigravity: 'Antigravity',
  'gentle-shell': 'Gentle Shell',
  other: 'Other'
}

export function prototypeMatchesFilter(filter: PrototypeFilter, agent: PrototypeAgent): boolean {
  return filter === 'all' || FILTER_AGENT[filter] === agent
}

export function prototypeAgentMono(agent: PrototypeAgent): string {
  return AGENT_MONO[agent]
}

/** The chat title when the chat has one, else the first words of the prompt the user wrote. */
export function prototypeTitle(
  set: Pick<PrototypeListedSet, 'chatTitle' | 'originalPrompt'>
): string {
  const chatTitle = set.chatTitle?.trim() ?? ''
  if (chatTitle.length > 0) {
    return chatTitle
  }
  const head = set.originalPrompt.trim().split(/\s+/u).slice(0, TITLE_WORD_LIMIT).join(' ')
  return head.length > TITLE_MAX_LENGTH ? `${head.slice(0, TITLE_MAX_LENGTH).trimEnd()}…` : head
}

/** A set with one direction shows as one screen; otherwise its direction count and the iterated letter. */
export type PrototypeStatus =
  | { kind: 'single' }
  | { kind: 'directions'; count: number; iterating: string }

export function prototypeStatus(
  set: Pick<PrototypeListedSet, 'directions'>,
  activeLetter: string | undefined
): PrototypeStatus {
  if (set.directions.length <= 1) {
    return { kind: 'single' }
  }
  const iterating = activeLetter ?? set.directions[0]?.letter ?? ''
  return { kind: 'directions', count: set.directions.length, iterating }
}

/** Compact age of the set's last write (or its creation when no file has one): "4m", "1h", "1d". */
export function prototypeAge(set: PrototypeListedSet, nowMs: number): string {
  const elapsedMs = Math.max(0, nowMs - latestWriteMs(set))
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }
  return `${Math.floor(hours / 24)}d`
}

function latestWriteMs(set: PrototypeListedSet): number {
  let latest = Date.parse(set.createdAt)
  for (const direction of set.directions) {
    for (const version of direction.versions) {
      latest = Math.max(latest, version.mtime)
    }
  }
  return Number.isNaN(latest) ? 0 : latest
}

export type PrototypeListRow = {
  set: PrototypeListedSet
  title: string
  mono: string
  status: PrototypeStatus
  age: string
}

/** The rows the list shows: the sets that pass the filter, in the host's order (newest first). */
export function buildPrototypeListRows({
  sets,
  filter,
  activeLetterOf,
  nowMs
}: {
  sets: readonly PrototypeListedSet[]
  filter: PrototypeFilter
  activeLetterOf: (requestId: string) => string | undefined
  nowMs: number
}): PrototypeListRow[] {
  return sets
    .filter((set) => prototypeMatchesFilter(filter, set.agent))
    .map((set) => ({
      set,
      title: prototypeTitle(set),
      mono: prototypeAgentMono(set.agent),
      status: prototypeStatus(set, activeLetterOf(set.requestId)),
      age: prototypeAge(set, nowMs)
    }))
}

/** The latest version of a direction: the file the frame shows and the one a new iteration follows. */
export function latestVersionOf(
  direction: PrototypeListedDirection | undefined
): { version: number; fileName: string } | null {
  let latest: { version: number; fileName: string } | null = null
  for (const candidate of direction?.versions ?? []) {
    if (latest === null || candidate.version > latest.version) {
      latest = { version: candidate.version, fileName: candidate.fileName }
    }
  }
  return latest
}
