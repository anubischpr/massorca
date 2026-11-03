import type {
  BotTeamVersion,
  BotTeamVersionFile,
  BotTeamVersionReason
} from '../../shared/rpc-contract/bot-team-version-params'

export type { BotTeamVersion, BotTeamVersionFile, BotTeamVersionReason }

export type BotTeamSnapshotLimits = {
  /** A file over this size is left out of a version and counted as skipped. */
  maxFileBytes: number
  /** A folder over this many files is refused. */
  maxFiles: number
  /** A version whose bytes the store does not hold yet, over this total, is refused. */
  maxNewBytes: number
}

export const BOT_TEAM_SNAPSHOT_LIMITS: BotTeamSnapshotLimits = {
  maxFileBytes: 100 * 1024 * 1024,
  maxFiles: 50_000,
  maxNewBytes: 2 * 1024 * 1024 * 1024
}

export type BotTeamSnapshotInput = {
  reason: BotTeamVersionReason
  label: string
  author?: string
}

export type BotTeamSnapshotFailure = 'too-large' | 'failed'

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
  /** A directory outside `folder` that holds the team's stored files and versions, made on first use. */
  storeDir: string
  limits?: BotTeamSnapshotLimits
  now?: () => number
}
