import { rm, rmdir } from 'node:fs/promises'
import path from 'node:path'
import { copyObjectTo } from './bot-team-content-store'
import { guarded, inLane, toFailure } from './bot-team-snapshot-run'
import { saveFolderVersion } from './bot-team-snapshots'
import type { BotTeamRestoreResult, BotTeamSnapshotDeps } from './bot-team-snapshot-types'
import {
  changesBetween,
  entryOf,
  readStoredVersion,
  toBotTeamVersion,
  type StoredFile,
  type StoredVersion
} from './bot-team-version-manifest'

const BEFORE_RESTORE = { reason: 'before-restore', label: 'Before restoring' } as const
const RESTORED = { reason: 'restored', label: 'Restored' } as const

function insideFolder(folder: string, relativePath: string): string | null {
  const segments = relativePath.split('/')
  if (relativePath === '' || path.isAbsolute(relativePath) || segments.includes('..')) {
    return null
  }
  return segments[0] === '.git' ? null : path.join(folder, ...segments)
}

async function removeEmptyParents(folder: string, file: string): Promise<void> {
  let directory = path.dirname(file)
  while (directory.startsWith(folder + path.sep)) {
    try {
      await rmdir(directory)
    } catch {
      return
    }
    directory = path.dirname(directory)
  }
}

async function writeFilesFrom(
  deps: BotTeamSnapshotDeps,
  target: StoredVersion,
  relativePaths: string[]
): Promise<void> {
  for (const relativePath of relativePaths) {
    const file = insideFolder(deps.folder, relativePath)
    const entry = entryOf(target.manifest.files, relativePath)
    if (file && entry) {
      await copyObjectTo(deps.storeDir, entry.hash, file)
    }
  }
}

async function applyVersion(
  deps: BotTeamSnapshotDeps,
  current: Record<string, StoredFile>,
  target: StoredVersion
): Promise<void> {
  const changes = changesBetween(current, target.manifest.files)
  for (const change of changes.filter((entry) => entry.status === 'deleted')) {
    const file = insideFolder(deps.folder, change.path)
    if (file) {
      await rm(file, { force: true })
      await removeEmptyParents(deps.folder, file)
    }
  }
  await writeFilesFrom(
    deps,
    target,
    changes.filter((entry) => entry.status !== 'deleted').map((entry) => entry.path)
  )
}

const missing = (message: string): BotTeamRestoreResult => ({
  ok: false,
  reason: 'missing-version',
  message
})

/** One file goes back to how a version held it; the rest of the folder stays as it is. */
export function restoreBotTeamFile(
  deps: BotTeamSnapshotDeps,
  versionId: string,
  relativePath: string
): Promise<BotTeamRestoreResult> {
  return inLane(deps.storeDir, async () => {
    try {
      const target = await guarded(() => readStoredVersion(deps.storeDir, versionId))
      if (!target || !insideFolder(deps.folder, relativePath)) {
        return missing('No such version.')
      }
      if (!entryOf(target.manifest.files, relativePath)) {
        return missing('That version has no such file.')
      }
      const saved = await guarded(() => saveFolderVersion(deps, BEFORE_RESTORE))
      await guarded(() => writeFilesFrom(deps, target, [relativePath]))
      await guarded(() => saveFolderVersion(deps, RESTORED))
      return {
        ok: true as const,
        restoredFrom: toBotTeamVersion(target),
        savedBefore: !saved.unchanged && saved.stored ? toBotTeamVersion(saved.stored) : null
      }
    } catch (error) {
      const failure = toFailure(error)
      return { ok: false as const, reason: failure.reason, message: failure.message }
    }
  })
}

/**
 * Puts a version's files back. The current state is saved first, so nothing is lost; files that
 * were never saved (ignored or over the size limit) are left alone.
 */
export function restoreBotTeamVersion(
  deps: BotTeamSnapshotDeps,
  versionId: string
): Promise<BotTeamRestoreResult> {
  return inLane(deps.storeDir, async () => {
    try {
      const target = await guarded(() => readStoredVersion(deps.storeDir, versionId))
      if (!target) {
        return missing('No such version.')
      }
      const saved = await guarded(() => saveFolderVersion(deps, BEFORE_RESTORE))
      await guarded(() => applyVersion(deps, saved.stored?.manifest.files ?? {}, target))
      await guarded(() => saveFolderVersion(deps, RESTORED))
      return {
        ok: true as const,
        restoredFrom: toBotTeamVersion(target),
        savedBefore: !saved.unchanged && saved.stored ? toBotTeamVersion(saved.stored) : null
      }
    } catch (error) {
      const failure = toFailure(error)
      return { ok: false as const, reason: failure.reason, message: failure.message }
    }
  })
}
