import type { Repo } from '../../../../../../shared/repo-types'
import { isFolderRepo } from '../../../../../../shared/repo-kind'
import { projectGroupIdFromRepoId } from '../../../../../../shared/folder-workspace-worktree'
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
  getOwnBranchPrefix,
  type BranchLabelEntry
} from '../../../../../../shared/worktree/branch-display-label'
import type { BranchPrefixSettings } from '../../../../../../shared/branch-prefix'
import { getWorktreeGitIdentityDisplay } from '@/lib/worktree-git-identity-display'
import { getDirectoryName } from '../../worktree-card-model'
import { PINNED_GROUP_KEY } from './group-keys'
import { getProjectGroupingForRepo, type ProjectGroupingIndex } from './project-grouping'
import type { Row, WorktreeGroupBy, WorktreeRow } from './row-types'

export type BranchQualifierInput = {
  identity: string
  /** The name the row reads as: a branch, a folder name or a detached HEAD's short SHA. */
  name: string
  /** A folder's parent folder: the fact left to tell two folders of one project and host apart. */
  location?: string
  projectKey: string
  projectLabel: string
  hostId: string
  hostLabel: string
}

/**
 * What tells two same-named rows apart, per worktree identity. Only the facts that differ in
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
    if (!input.name) {
      continue
    }
    const key = `${scope === 'project' ? input.projectKey : ''}\0${input.name}`
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
    // Why counted up front: a list of many same-named rows must stay linear.
    const slotKey = (input: BranchQualifierInput): string => `${input.projectKey}\0${input.hostId}`
    const slotSizes = new Map<string, number>()
    for (const input of group) {
      slotSizes.set(slotKey(input), (slotSizes.get(slotKey(input)) ?? 0) + 1)
    }
    for (const input of group) {
      // Folders of one project on one host share every fact above, so their parent folder decides.
      const sharesSlot = (slotSizes.get(slotKey(input)) ?? 0) > 1
      const parts = [
        ...(projectsDiffer ? [input.projectLabel] : []),
        ...(hostsDiffer ? [input.hostLabel] : []),
        ...(input.location && sharesSlot ? [input.location] : [])
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
  const projectLabelEntries: BranchLabelEntry[] = []
  const listLabelEntries: BranchLabelEntry[] = []
  for (const worktree of context.worktrees) {
    const identity = getWorktreeHostIdentity(worktree)
    const repo = repoMap.get(worktree.repoId)
    const project = getProjectGroupingForRepo(worktree.repoId, repoMap, projectIndex)
    const hostId =
      projectIndex?.setupByRepoId.get(worktree.repoId)?.hostId ??
      getWorktreeExecutionHostId(worktree, repo, context.defaultHostId) ??
      (repo ? getRepoExecutionHostId(repo) : context.defaultHostId)
    const collisionName = getRowCollisionName(worktree, repo, context.branchPrefixSettings)
    inputs.push({
      identity,
      name: collisionName.text,
      ...(collisionName.location ? { location: collisionName.location } : {}),
      projectKey: project.key,
      projectLabel: project.label,
      hostId,
      hostLabel: getHostContextLabel(hostId, { hostLabelById: context.hostLabelById })
    })
    const labelEntry = {
      key: identity,
      branch: collisionName.text,
      ownPrefix: collisionName.ownPrefix
    }
    projectLabelEntries.push({ ...labelEntry, scope: project.key })
    listLabelEntries.push({ ...labelEntry, scope: '' })
  }
  const projectLabels = getBranchDisplayLabels(projectLabelEntries)
  const listLabels = getBranchDisplayLabels(listLabelEntries)
  const projectQualifiers = getBranchQualifiers(inputs, 'project')
  const listQualifiers = getBranchQualifiers(inputs, 'list')
  for (const row of rows) {
    if (row.type !== 'item') {
      continue
    }
    // Pinned rows mix projects under no project header, so they compare like a flat list.
    const flat = context.groupBy !== 'repo' || row.sectionKey === PINNED_GROUP_KEY
    stampRow(row, flat ? listLabels : projectLabels, flat ? listQualifiers : projectQualifiers)
  }
}

type RowCollisionName = {
  text: string
  ownPrefix: string | null
  location?: string
}

function isFolderWorktree(worktree: Worktree, repo: Repo | undefined): boolean {
  return repo ? isFolderRepo(repo) : projectGroupIdFromRepoId(worktree.repoId) !== null
}

// The name a row reads as before any prefix is stripped. Only a branch has a prefix to hide.
function getRowCollisionName(
  worktree: Worktree,
  repo: Repo | undefined,
  branchPrefixSettings: BranchPrefixSettings | null
): RowCollisionName {
  if (isFolderWorktree(worktree, repo)) {
    const parent = worktree.path.replace(/[\\/]+[^\\/]*[\\/]*$/, '')
    return {
      text: getDirectoryName(worktree.path),
      ownPrefix: null,
      location: getDirectoryName(parent)
    }
  }
  const display = getWorktreeGitIdentityDisplay(worktree)
  if (display?.kind === 'detached') {
    return { text: display.shortHead, ownPrefix: null }
  }
  if (display?.kind === 'branch') {
    return {
      text: display.branchName,
      ownPrefix: getOwnBranchPrefix(branchPrefixSettings, repo?.gitUsername)
    }
  }
  return { text: '', ownPrefix: null }
}

function stampRow(
  row: WorktreeRow,
  labels: ReadonlyMap<string, string>,
  qualifiers: ReadonlyMap<string, string>
): void {
  const identity = getWorktreeHostIdentity(row.worktree)
  const label = labels.get(identity)
  if (label) {
    row.branchLabel = label
  }
  const qualifier = qualifiers.get(identity)
  if (qualifier) {
    row.branchQualifier = qualifier
  }
}
