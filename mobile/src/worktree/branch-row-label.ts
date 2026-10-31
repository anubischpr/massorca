import { resolveOneLineRowLabel } from '../../../src/shared/worktree/branch-display-label'

export type BranchRowIcon = 'branch' | 'folder'

export type BranchRowLabelSource = {
  workspaceKind?: 'git' | 'folder-workspace'
  repo: string
  branch: string
  manualDisplayName?: string | null
  path?: string
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

/**
 * The one-line row label: the user's row name when set, else the branch (a folder workspace shows
 * its folder name). The repo is the last resort, and only when there is no branch at all. The
 * generated display name never labels a row.
 */
export function resolveBranchRowLabel(source: BranchRowLabelSource): {
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
  return {
    label: resolveOneLineRowLabel(
      source.manualDisplayName,
      displayBranchName(source.branch) || source.repo
    ),
    icon: 'branch'
  }
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
