import type {
  BotTeamVersion,
  BotTeamVersionFile,
  BotTeamVersionReason
} from '../../shared/rpc-contract/bot-team-version-params'
import type { BotTeamSnapshotGit } from './bot-team-snapshot-git'

export type { BotTeamVersion, BotTeamVersionFile, BotTeamVersionReason }

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
