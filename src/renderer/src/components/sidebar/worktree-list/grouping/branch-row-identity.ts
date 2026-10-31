import type { Repo } from '../../../../../../shared/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import {
  getRepoExecutionHostId,
  getWorktreeExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host'
import { getHostContextLabel } from '../../../../../../shared/worktree/host-context-labels'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import {
  getBranchDisplayLabels,
  getOwnBranchPrefix
} from '../../../../../../shared/worktree/branch-display-label'
import type { BranchPrefixSettings } from '../../../../../../shared/branch-prefix'
import { getWorktreeGitIdentityDisplay } from '@/lib/worktree-git-identity-display'
import { PINNED_GROUP_KEY } from './group-keys'
import { getProjectGroupingForRepo, type ProjectGroupingIndex } from './project-grouping'
import type { Row, WorktreeGroupBy, WorktreeRow } from './row-types'

export type BranchQualifierInput = {
  identity: string
  branch: string
  projectKey: string
  projectLabel: string
  hostId: string
  hostLabel: string
}

/**
 * What tells two same-named branches apart, per worktree identity. Only the facts that differ in
 * the colliding set are named: a project when projects differ, a host when hosts differ.
 * `project` scope compares inside each project (the grouped list); `list` scope compares every
 * worktree (flat, status, PR and pinned lists, which show no project header).
 */
export function getBranchQualifiers(
  inputs: readonly BranchQualifierInput[],
  scope: 'project' | 'list'
): Map<string, string> {
  const collisions = new Map<string, BranchQualifierInput[]>()
  for (const input of inputs) {
    if (!input.branch) {
      continue
    }
    const key = `${scope === 'project' ? input.projectKey : ''}\0${input.branch}`
    const group = collisions.get(key) ?? []
    group.push(input)
    collisions.set(key, group)
  }
  const qualifiers = new Map<string, string>()
  for (const group of collisions.values()) {
    if (group.length < 2) {
      continue
    }
    const projectsDiffer = new Set(group.map((input) => input.projectKey)).size > 1
    const hostsDiffer = new Set(group.map((input) => input.hostId)).size > 1
    for (const input of group) {
      const parts = [
        ...(projectsDiffer ? [input.projectLabel] : []),
        ...(hostsDiffer ? [input.hostLabel] : [])
      ]
      if (parts.length > 0) {
        qualifiers.set(input.identity, parts.join(' · '))
      }
    }
  }
  return qualifiers
}

type RowIdentityContext = {
  groupBy: WorktreeGroupBy
  worktrees: readonly Worktree[]
  repoMap: Map<string, Repo>
  projectIndex: ProjectGroupingIndex | null
  branchPrefixSettings: BranchPrefixSettings | null
  hostLabelById: ReadonlyMap<string, string> | undefined
  defaultHostId: ExecutionHostId
}

/**
 * Stamps the one-line card's label and disambiguator onto item rows. It reads every worktree of
 * the list, not only the emitted rows, so a collapsed project still counts toward a collision.
 */
export function attachBranchRowIdentity(rows: Row[], context: RowIdentityContext): void {
  const { repoMap, projectIndex } = context
  const inputs: BranchQualifierInput[] = []
  const labelEntries: Parameters<typeof getBranchDisplayLabels>[0][number][] = []
  for (const worktree of context.worktrees) {
    const identity = getWorktreeHostIdentity(worktree)
    const display = getWorktreeGitIdentityDisplay(worktree)
    const branch = display?.kind === 'branch' ? display.branchName : ''
    const repo = repoMap.get(worktree.repoId)
    const project = getProjectGroupingForRepo(worktree.repoId, repoMap, projectIndex)
    const hostId =
      projectIndex?.setupByRepoId.get(worktree.repoId)?.hostId ??
      getWorktreeExecutionHostId(worktree, repo, context.defaultHostId) ??
      (repo ? getRepoExecutionHostId(repo) : context.defaultHostId)
    inputs.push({
      identity,
      branch,
      projectKey: project.key,
      projectLabel: project.label,
      hostId,
      hostLabel: getHostContextLabel(hostId, { hostLabelById: context.hostLabelById })
    })
    labelEntries.push({
      key: identity,
      branch,
      scope: project.key,
      ownPrefix: getOwnBranchPrefix(context.branchPrefixSettings, repo?.gitUsername)
    })
  }
  const labels = getBranchDisplayLabels(labelEntries)
  const projectScoped = getBranchQualifiers(inputs, 'project')
  const listScoped = getBranchQualifiers(inputs, 'list')
  for (const row of rows) {
    if (row.type !== 'item') {
      continue
    }
    stampRow(row, context.groupBy, labels, projectScoped, listScoped)
  }
}

function stampRow(
  row: WorktreeRow,
  groupBy: WorktreeGroupBy,
  labels: ReadonlyMap<string, string>,
  projectScoped: ReadonlyMap<string, string>,
  listScoped: ReadonlyMap<string, string>
): void {
  const identity = getWorktreeHostIdentity(row.worktree)
  const label = labels.get(identity)
  if (label) {
    row.branchLabel = label
  }
  // Pinned rows mix projects under no project header, so they compare like a flat list.
  const qualifiers =
    groupBy === 'repo' && row.sectionKey !== PINNED_GROUP_KEY ? projectScoped : listScoped
  const qualifier = qualifiers.get(identity)
  if (qualifier) {
    row.branchQualifier = qualifier
  }
}
