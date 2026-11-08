import { useMemo } from 'react'
import type { WorkspaceStatusDefinition } from '../../../src/shared/worktree/types'
import { getBranchRowLabels } from './branch-row-label'
import {
  arrangeBranchRowSections,
  placeCrossWorktreeAgents,
  type AgentRunOwner
} from './cross-worktree-agent-placement'
import type { MobileGroupMode, MobileSortMode } from './workspace-view-settings'
import {
  buildSections,
  type FilterState,
  type Section,
  type Worktree
} from './workspace-list-sections'
import { repoColor } from './repo-color'
import { getWorktreeRowIdentity } from './worktree-host-row-identity'

export type WorkspaceSectionRepo = {
  name: string
  id: string
  color: string
}

export function useWorkspaceSections(args: {
  displayWorktrees: Worktree[]
  sortMode: MobileSortMode
  filters: FilterState
  search: string
  groupMode: MobileGroupMode
  pinnedIds: Set<string>
  showPinnedInGroups: boolean
  repoIdsByName: Map<string, string>
  repoColorsByName: Map<string, string>
  collapsedGroups: Set<string>
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
}): {
  sections: Section[]
  rawSections: Section[]
  uniqueRepos: WorkspaceSectionRepo[]
  uniqueRepoColors: Map<string, string>
  /** Each session listed under a parent in another worktree: the worktree it runs in and its branch. */
  agentOwners: ReadonlyMap<string, AgentRunOwner>
  /** The branch part of each git row's label, keyed by the row identity. */
  branchLabels: ReadonlyMap<string, string>
} {
  const {
    displayWorktrees,
    sortMode,
    filters,
    search,
    groupMode,
    pinnedIds,
    showPinnedInGroups,
    repoIdsByName,
    repoColorsByName,
    collapsedGroups,
    workspaceStatuses
  } = args

  const uniqueRepos = useMemo(() => {
    const repos = new Map<string, { id: string; color: string }>()
    for (const w of displayWorktrees) {
      if (!repos.has(w.repo)) {
        repos.set(w.repo, {
          id: repoIdsByName.get(w.repo) ?? w.repoId,
          color: repoColorsByName.get(w.repo) ?? repoColor(w.repo)
        })
      }
    }
    return [...repos.entries()].map(([name, { id, color }]) => ({ name, id, color }))
  }, [displayWorktrees, repoColorsByName, repoIdsByName])

  const uniqueRepoColors = useMemo(
    () => new Map(uniqueRepos.map((repo) => [repo.name, repo.color])),
    [uniqueRepos]
  )

  const listedSections = useMemo(
    () =>
      buildSections(
        displayWorktrees,
        sortMode,
        filters,
        search,
        groupMode,
        pinnedIds,
        repoIdsByName,
        workspaceStatuses,
        collapsedGroups,
        showPinnedInGroups
      ),
    [
      displayWorktrees,
      sortMode,
      filters,
      search,
      groupMode,
      pinnedIds,
      repoIdsByName,
      workspaceStatuses,
      collapsedGroups,
      showPinnedInGroups
    ]
  )

  // Why: one pass over every section, before collapsed groups are emptied, so a session keeps its
  // place under a parent whose group is folded instead of reappearing in its own worktree.
  const placement = useMemo(
    () => placeCrossWorktreeAgents(listedSections, displayWorktrees),
    [listedSections, displayWorktrees]
  )
  // Why: a worktree row whose sessions all run under another parent is dropped here, and its lineage is laid out again.
  const rawSections = useMemo(
    () => arrangeBranchRowSections(placement.sections, placement, collapsedGroups),
    [placement, collapsedGroups]
  )

  const branchLabels = useMemo(
    () =>
      getBranchRowLabels(
        rawSections.flatMap((section) =>
          section.data.map((item) => ({
            key: getWorktreeRowIdentity(item),
            scope: groupMode === 'repo' ? item.repoId : '',
            workspaceKind: item.workspaceKind,
            branch: item.branch,
            ownBranchPrefix: item.ownBranchPrefix
          }))
        )
      ),
    [rawSections, groupMode]
  )

  const sections = useMemo(
    () =>
      rawSections.map((s) => ({
        ...s,
        data: collapsedGroups.has(s.key) ? [] : s.data
      })),
    [rawSections, collapsedGroups]
  )

  return {
    sections,
    rawSections,
    uniqueRepos,
    uniqueRepoColors,
    agentOwners: placement.ownersByPaneKey,
    branchLabels
  }
}
