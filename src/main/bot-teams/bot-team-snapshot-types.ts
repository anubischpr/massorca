import type { BotTeamSnapshotGit } from './bot-team-snapshot-git'

export type BotTeamSnapshotLimits = {
  maxFileBytes: number
  maxTotalBytes: number
  maxFiles: number
}

export const BOT_TEAM_SNAPSHOT_LIMITS: BotTeamSnapshotLimits = {
  maxFileBytes: 5 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  maxFiles: 20_000
}

export type BotTeamVersionReason = 'task-finished' | 'before-restore' | 'restored' | 'other'

export type BotTeamVersion = {
  /** The hidden ref's last segment; grows with each new version. */
  id: string
  commit: string
  tree: string
  createdAt: number
  reason: BotTeamVersionReason
  label: string
  /** Files left out of this version because they were over the size limit. */
  skipped: number
  /** The bot whose finished task caused the save; null for the person's own actions. */
  author: string | null
}

export type BotTeamSnapshotInput = {
  reason: BotTeamVersionReason
  label: string
  author?: string
}

export type BotTeamSnapshotFailure = 'git-unavailable' | 'too-large' | 'failed'

export type BotTeamSnapshotResult =
  | { ok: true; version: BotTeamVersion | null; unchanged: boolean }
  | { ok: false; reason: BotTeamSnapshotFailure; message: string }

export type BotTeamRestoreResult =
  | { ok: true; restoredFrom: BotTeamVersion; savedBefore: BotTeamVersion | null }
  | { ok: false; reason: BotTeamSnapshotFailure | 'missing-version'; message: string }

export type BotTeamVersionChange = { status: 'added' | 'modified' | 'deleted'; path: string }

export type BotTeamVersionFile =
  | { kind: 'text'; text: string }
  | { kind: 'binary' }
  | { kind: 'too-large' }
  | { kind: 'missing' }

export type BotTeamSnapshotDeps = {
  /** The team's folder. */
  folder: string
  /** A directory outside `folder`, made on first use. */
  gitDir: string
  git?: BotTeamSnapshotGit
  limits?: BotTeamSnapshotLimits
  now?: () => number
}

export const BOT_TEAM_VERSION_REF_PREFIX = 'refs/massorca/versions/'
export const BOT_TEAM_EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
