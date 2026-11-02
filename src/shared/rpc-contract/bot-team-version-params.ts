import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const BotTeamVersionsSelector = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamFileVersionsSelector = z.object({
  teamId: requiredString('Missing team id'),
  relativePath: requiredString('Missing file path')
})

export const BotTeamVersionFileSelector = z.object({
  teamId: requiredString('Missing team id'),
  versionId: requiredString('Missing version id'),
  relativePath: requiredString('Missing file path')
})

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

/** A host that cannot keep versions says why, so the screens can leave them out. */
export type BotTeamVersionsResult =
  | {
      git: 'ok'
      versions: BotTeamVersion[]
      /** Each file's newest version, so the file list can say when it last changed. */
      lastVersionOfFile: Record<string, string>
    }
  | { git: 'unavailable' }

export type BotTeamFileVersion = { version: BotTeamVersion; deleted: boolean }

export type BotTeamVersionFile =
  | { kind: 'text'; text: string }
  | { kind: 'binary' }
  | { kind: 'too-large' }
  | { kind: 'missing' }

export type BotTeamVersionFailure = 'git-unavailable' | 'too-large' | 'failed' | 'missing-version'

export type BotTeamVersionRestoreResult =
  | { ok: true; restoredFrom: BotTeamVersion; savedBefore: BotTeamVersion | null }
  | { ok: false; reason: BotTeamVersionFailure; message: string }
