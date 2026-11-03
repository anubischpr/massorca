import {
  ensureStoreDirectories,
  FileOverLimitError,
  hasObject,
  hashFile,
  isMissingFile,
  storeFile
} from './bot-team-content-store'
import { savableFilesOf, type SavableFile } from './bot-team-snapshot-files'
import { guarded, inLane, SnapshotFailure, toFailure } from './bot-team-snapshot-run'
import {
  BOT_TEAM_SNAPSHOT_LIMITS,
  type BotTeamSnapshotDeps,
  type BotTeamSnapshotInput,
  type BotTeamSnapshotLimits,
  type BotTeamSnapshotResult,
  type BotTeamVersion
} from './bot-team-snapshot-types'
import {
  changesBetween,
  formatVersionId,
  readStoredVersion,
  readVersionIds,
  toBotTeamVersion,
  writeStoredVersion,
  type StoredFile,
  type StoredVersion
} from './bot-team-version-manifest'

/**
 * Versions of a team's folder. Their files are copied into a store kept outside the folder, so the
 * person's own files are read and never changed.
 */

const VERSIONS_SHOWN = 200
const LABEL_LENGTH = 120
const TOO_LARGE = 'This folder is too large to save as a version.'
const CHANGED_WHILE_SAVING = 'A file changed while it was being saved. Try again.'

function oneLine(text: string): string {
  return (
    text
      .replace(/[\0\r\n]+/g, ' ')
      .trim()
      .slice(0, LABEL_LENGTH) || 'Saved'
  )
}

/** Newest first. */
export async function listBotTeamVersions(deps: BotTeamSnapshotDeps): Promise<BotTeamVersion[]> {
  return guarded(async () => {
    const ids = (await readVersionIds(deps.storeDir)).slice(0, VERSIONS_SHOWN)
    const versions: BotTeamVersion[] = []
    for (const id of ids) {
      const stored = await readStoredVersion(deps.storeDir, id)
      if (stored) {
        versions.push(toBotTeamVersion(stored))
      }
    }
    return versions
  })
}

type Measured =
  | { kind: 'measured'; hash: string; size: number }
  | { kind: 'over-limit' }
  | { kind: 'vanished' }

async function measure(file: SavableFile, maxFileBytes: number): Promise<Measured> {
  try {
    return { kind: 'measured', ...(await hashFile(file.absolutePath, maxFileBytes)) }
  } catch (error) {
    if (error instanceof FileOverLimitError) {
      return { kind: 'over-limit' }
    }
    if (isMissingFile(error)) {
      return { kind: 'vanished' }
    }
    throw error
  }
}

function sortedFiles(entries: Map<string, StoredFile>): Record<string, StoredFile> {
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

/**
 * Stores the folder's files and writes a new version, unless the newest version already holds
 * exactly these files. Files are hashed first, so a refused version writes no object.
 */
export async function saveFolderVersion(
  deps: BotTeamSnapshotDeps,
  input: BotTeamSnapshotInput
): Promise<{ stored: StoredVersion | null; unchanged: boolean }> {
  const limits: BotTeamSnapshotLimits = deps.limits ?? BOT_TEAM_SNAPSHOT_LIMITS
  await ensureStoreDirectories(deps.storeDir)
  const savable = await savableFilesOf(deps.folder, limits)
  const entries = new Map<string, StoredFile>()
  // One file per new content: identical new files are copied once.
  const fresh = new Map<string, SavableFile>()
  let skipped = savable.skipped
  let newBytes = 0

  for (const file of savable.files) {
    const measured = await measure(file, limits.maxFileBytes)
    if (measured.kind === 'over-limit') {
      skipped += 1
      continue
    }
    if (measured.kind === 'vanished') {
      continue
    }
    entries.set(file.relativePath, { hash: measured.hash, size: measured.size })
    if (!fresh.has(measured.hash) && !(await hasObject(deps.storeDir, measured.hash))) {
      fresh.set(measured.hash, file)
      newBytes += measured.size
    }
  }
  if (newBytes > limits.maxNewBytes) {
    throw new SnapshotFailure('too-large', TOO_LARGE)
  }

  for (const [hash, file] of fresh) {
    if (await hasObject(deps.storeDir, hash)) {
      continue
    }
    try {
      entries.set(
        file.relativePath,
        await storeFile(deps.storeDir, file.absolutePath, limits.maxFileBytes)
      )
    } catch (error) {
      if (error instanceof FileOverLimitError) {
        entries.delete(file.relativePath)
        skipped += 1
      } else if (isMissingFile(error)) {
        entries.delete(file.relativePath)
      } else {
        throw error
      }
    }
  }
  // A file that changed under the save leaves an entry without its object: no version is written.
  for (const entry of entries.values()) {
    if (!(await hasObject(deps.storeDir, entry.hash))) {
      throw new SnapshotFailure('failed', CHANGED_WHILE_SAVING)
    }
  }

  const files = sortedFiles(entries)
  const latestId = (await readVersionIds(deps.storeDir))[0]
  const latest = latestId === undefined ? null : await readStoredVersion(deps.storeDir, latestId)
  const unchanged = latest
    ? changesBetween(latest.manifest.files, files).length === 0
    : Object.keys(files).length === 0
  if (unchanged) {
    return { stored: latest, unchanged: true }
  }

  const createdAt = Math.floor((deps.now ?? Date.now)() / 1000) * 1000
  const stored = await writeStoredVersion(deps.storeDir, {
    id: formatVersionId(latestId === undefined ? 1 : Number(latestId) + 1),
    createdAt,
    reason: input.reason,
    label: oneLine(input.label),
    author: input.author ? oneLine(input.author) : null,
    skipped,
    files
  })
  return { stored, unchanged: false }
}

/** Callers hold the team's lane, so the next number cannot be taken by another save. */
export async function saveBotTeamSnapshot(
  deps: BotTeamSnapshotDeps,
  input: BotTeamSnapshotInput
): Promise<{ version: BotTeamVersion | null; unchanged: boolean }> {
  const saved = await saveFolderVersion(deps, input)
  return {
    version: saved.stored ? toBotTeamVersion(saved.stored) : null,
    unchanged: saved.unchanged
  }
}

/** Saves the folder as a new version, unless nothing changed since the last one. */
export function takeBotTeamSnapshot(
  deps: BotTeamSnapshotDeps,
  input: BotTeamSnapshotInput
): Promise<BotTeamSnapshotResult> {
  return inLane(deps.storeDir, async () => {
    try {
      const saved = await guarded(() => saveBotTeamSnapshot(deps, input))
      return { ok: true as const, ...saved }
    } catch (error) {
      const failure = toFailure(error)
      return { ok: false as const, reason: failure.reason, message: failure.message }
    }
  })
}
