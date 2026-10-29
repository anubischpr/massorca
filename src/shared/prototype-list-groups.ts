// The Prototypes list grouped by project: each project's pinned design system row, then its rows. The host
// lists sets newest first, so a project's place in the list is the place of its newest set.
import type { PrototypeListRow } from './prototype-list-model'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from './rpc-contract/prototype-params'

export type PrototypeListGroup = {
  /** The project of the group; null for sets the host placed in no project. */
  projectKey: string | null
  /** The project's name for the group header; null when the group has none. */
  projectName: string | null
  /** The project's design system, pinned at the top of the group when it has one. */
  system: PrototypeListedDesignSystem | null
  /** The rows the agent filter keeps, newest first. */
  rows: PrototypeListRow[]
}

/**
 * The groups of the list. `sets` is every listed set, newest first, so the groups come in the order of
 * their newest set; `rows` is what the agent filter keeps. A design system row stays when the filter
 * hides every set of its project. A system whose project has no listed set has no group: the list has no
 * set through which to show it.
 */
export function buildPrototypeListGroups({
  sets,
  rows,
  designSystems
}: {
  sets: readonly PrototypeListedSet[]
  rows: readonly PrototypeListRow[]
  designSystems: readonly PrototypeListedDesignSystem[]
}): PrototypeListGroup[] {
  const systemOf = new Map(designSystems.map((system) => [system.projectKey, system]))
  const projectKeys = [
    ...new Set(sets.flatMap((set) => (set.projectKey === undefined ? [] : [set.projectKey])))
  ]
  const groups = projectKeys.flatMap((projectKey): PrototypeListGroup[] => {
    const groupRows = rows.filter((row) => row.set.projectKey === projectKey)
    const system = systemOf.get(projectKey) ?? null
    if (groupRows.length === 0 && system === null) {
      return []
    }
    return [
      {
        projectKey,
        projectName: projectNameOf(projectKey, sets, system),
        system,
        rows: groupRows
      }
    ]
  })
  const unprojected = rows.filter((row) => row.set.projectKey === undefined)
  return unprojected.length > 0
    ? [...groups, { projectKey: null, projectName: null, system: null, rows: unprojected }]
    : groups
}

function projectNameOf(
  projectKey: string,
  sets: readonly PrototypeListedSet[],
  system: PrototypeListedDesignSystem | null
): string | null {
  return (
    sets.find((set) => set.projectKey === projectKey)?.projectName ?? system?.projectName ?? null
  )
}
