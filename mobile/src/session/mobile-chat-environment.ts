import { parseExecutionHostId } from '../../../src/shared/execution-host'
import type { GhAccountBinding } from '../../../src/shared/github/account-binding'

/** The worktree fields the Summary's environment tiles read, taken from one `worktree.ps` row. */
export type MobileChatEnvironmentWorktree = {
  repoId: string
  repo: string
  branch: string
  path: string
  folder: boolean
  hostId: string | null
  hostContextLabel: string | null
}

const LOCAL_HOST_LABEL = 'This computer'

function stringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Reads one catalog row the way the Summary needs it. Rows are opaque on the wire, so a row missing
 *  the fields the tiles show answers null and the Summary shows no environment for it. */
export function environmentWorktreeFromRow(
  worktreeId: string,
  row: unknown
): MobileChatEnvironmentWorktree | null {
  if (typeof row !== 'object' || row === null) {
    return null
  }
  const fields: Record<string, unknown> = { ...row }
  if (stringField(fields, 'worktreeId') !== worktreeId) {
    return null
  }
  const repoId = stringField(fields, 'repoId')
  const repo = stringField(fields, 'repo')
  const path = stringField(fields, 'path')
  if (repoId === null || repo === null || path === null) {
    return null
  }
  return {
    repoId,
    repo,
    branch: stringField(fields, 'branch') ?? '',
    path,
    folder: fields.workspaceKind === 'folder-workspace',
    hostId: stringField(fields, 'hostId'),
    hostContextLabel: stringField(fields, 'hostContextLabel')
  }
}

/** Where the worktree runs: its host's label when the catalog gives one, the SSH target's name for an
 *  SSH host, and "This computer" for the paired computer itself. */
export function environmentHostLabel(worktree: MobileChatEnvironmentWorktree): string {
  if (worktree.hostContextLabel) {
    return worktree.hostContextLabel
  }
  const parsed = parseExecutionHostId(worktree.hostId)
  return parsed?.kind === 'ssh' ? parsed.targetId : LOCAL_HOST_LABEL
}

/** The last segment of a path, read across both separators, for a folder workspace's name. */
export function folderNameFromPath(path: string): string {
  const segments = path.split(/[\\/]/).filter((segment) => segment.length > 0)
  return segments[segments.length - 1] ?? path
}

export type MobileChatEnvironmentIcon = 'account' | 'project' | 'branch' | 'folder' | 'host'

export type MobileChatEnvironmentTile = {
  key: string
  icon: MobileChatEnvironmentIcon
  label: string
  value: string
}

/** The Summary's environment tiles. The GitHub tile is absent when no account is bound or the host
 *  predates the field, so an older host shows three tiles rather than an empty one. */
export function environmentTiles(input: {
  worktree: MobileChatEnvironmentWorktree
  ghAccount: GhAccountBinding | null
}): MobileChatEnvironmentTile[] {
  const { worktree, ghAccount } = input
  const tiles: MobileChatEnvironmentTile[] = []
  if (ghAccount) {
    tiles.push({ key: 'account', icon: 'account', label: 'GitHub account', value: ghAccount.user })
  }
  tiles.push({ key: 'project', icon: 'project', label: 'Project', value: worktree.repo })
  if (worktree.folder) {
    tiles.push({
      key: 'folder',
      icon: 'folder',
      label: 'Folder',
      value: folderNameFromPath(worktree.path)
    })
  } else if (worktree.branch) {
    tiles.push({ key: 'branch', icon: 'branch', label: 'Branch', value: worktree.branch })
  }
  tiles.push({
    key: 'host',
    icon: 'host',
    label: 'Host',
    value: environmentHostLabel(worktree)
  })
  return tiles
}
