import {
  getBranchDisplayLabels,
  resolveOneLineRowLabel,
  type BranchLabelEntry
} from '../../../src/shared/worktree/branch-display-label'

export type BranchRowIcon = 'branch' | 'folder' | 'commit'

export type BranchRowLabelSource = {
  workspaceKind?: 'git' | 'folder-workspace'
  repo: string
  branch: string
  /** The commit a detached HEAD sits on; a row with no branch names itself by its short SHA. */
  head?: string
  manualDisplayName?: string | null
  /** The worktree's name on desktop: its branch when automatic, else a generated or pinned name. */
  displayName?: string | null
  path?: string
}

/** The commit's short SHA, abbreviated the way git does by default. */
export function shortCommitSha(head: string): string {
  return head.trim().slice(0, 7)
}

/** The branch as the row shows it, without its refs/heads/ prefix. Mobile cannot reach the user's own prefix. */
export function displayBranchName(branch: string): string {
  return branch.replace(/^refs\/heads\//, '').trim()
}

/** The last segment of a folder workspace path, for POSIX and Windows separators alike. */
export function folderNameFromPath(path: string | undefined): string {
  const segments = (path ?? '').split(/[\\/]+/).filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? ''
}

/** The worktree's own name when it is set and not just its branch: a generated or pinned name. */
function nameBeyondBranch(displayName: string | null | undefined, branch: string): string | null {
  const name = displayName?.trim() ?? ''
  return name && name !== branch ? name : null
}

/**
 * The one-line row label: the user's row name when set, else the worktree's own name when it is not
 * just its branch, else the branch (a folder workspace shows its folder name). A detached row shows
 * its short SHA with a commit icon. The repo is the last resort, and only when there is no branch and
 * no commit. `branchLabel` is the branch with the user's own prefix dropped, when the list computed one.
 */
export function resolveBranchRowLabel(
  source: BranchRowLabelSource,
  options: { branchLabel?: string | null } = {}
): {
  label: string
  icon: BranchRowIcon
} {
  if (source.workspaceKind === 'folder-workspace') {
    return {
      label: resolveOneLineRowLabel(
        source.manualDisplayName,
        folderNameFromPath(source.path) || source.repo
      ),
      icon: 'folder'
    }
  }
  const branch = displayBranchName(source.branch)
  const sha = branch ? '' : shortCommitSha(source.head ?? '')
  if (sha) {
    return { label: resolveOneLineRowLabel(source.manualDisplayName, sha), icon: 'commit' }
  }
  const ownName = branch ? nameBeyondBranch(source.displayName, branch) : null
  return {
    label: resolveOneLineRowLabel(
      source.manualDisplayName,
      ownName ?? (options.branchLabel || branch || source.repo)
    ),
    icon: 'branch'
  }
}

export type BranchRowLabelInput = {
  key: string
  /** Rows compete for a label only inside one scope: a project, or the whole list. */
  scope: string
  workspaceKind?: 'git' | 'folder-workspace'
  branch: string
  ownBranchPrefix?: string
}

/**
 * The branch part of each git row's label, keyed by the row key. The user's own prefix is dropped,
 * except where two different branches in one scope would then share a label.
 */
export function getBranchRowLabels(rows: readonly BranchRowLabelInput[]): Map<string, string> {
  const entries: BranchLabelEntry[] = []
  for (const row of rows) {
    const branch = row.workspaceKind === 'folder-workspace' ? '' : displayBranchName(row.branch)
    if (branch) {
      entries.push({
        key: row.key,
        branch,
        scope: row.scope,
        ownPrefix: row.ownBranchPrefix ?? null
      })
    }
  }
  return getBranchDisplayLabels(entries)
}

export type BranchCollisionEntry = {
  key: string
  /** Rows compete for a chip only inside one scope: the whole flat list, or one repo section. */
  scope: string
  /** The branch as the row shows it; empty for a folder workspace or a row with no branch. */
  branch: string
  repo: string
  hostKey: string
  hostLabel?: string
}

/**
 * The chip that names what differs between rows sharing one branch: the host when they run on
 * different hosts, else the project. Rows with a unique branch get no chip.
 */
export function getBranchCollisionChips(
  entries: readonly BranchCollisionEntry[]
): Map<string, string> {
  const groups = new Map<string, BranchCollisionEntry[]>()
  for (const entry of entries) {
    if (!entry.branch) {
      continue
    }
    const id = `${entry.scope}\0${entry.branch}`
    const group = groups.get(id)
    if (group) {
      group.push(entry)
    } else {
      groups.set(id, [entry])
    }
  }
  const chips = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue
    }
    for (const entry of group) {
      const others = group.filter((other) => other !== entry)
      const hostDiffers = others.some((other) => other.hostKey !== entry.hostKey)
      const repoDiffers = others.some((other) => other.repo !== entry.repo)
      const chip =
        hostDiffers && entry.hostLabel ? entry.hostLabel : repoDiffers ? entry.repo : null
      if (chip) {
        chips.set(entry.key, chip)
      }
    }
  }
  return chips
}
