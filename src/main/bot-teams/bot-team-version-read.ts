import { readFile } from 'node:fs/promises'
import { isBinaryBuffer } from '../../shared/binary-buffer'
import type {
  BotTeamFileVersion,
  BotTeamVersion
} from '../../shared/rpc-contract/bot-team-version-params'
import { objectPath, readObjectHead } from './bot-team-content-store'
import { guarded } from './bot-team-snapshot-run'
import type {
  BotTeamSnapshotDeps,
  BotTeamVersionChange,
  BotTeamVersionFile
} from './bot-team-snapshot-types'
import {
  changesBetween,
  entryOf,
  readStoredVersion,
  readVersionIds,
  sameFile,
  toBotTeamVersion,
  type StoredVersion
} from './bot-team-version-manifest'

/** The version with this id, from a list already read. */
export function findBotTeamVersion(
  versions: BotTeamVersion[],
  id: string
): BotTeamVersion | undefined {
  return versions.find((version) => version.id === id)
}

// Text beyond this size is not read back; it is shown by its size instead.
const FILE_PREVIEW_BYTES = 1024 * 1024
const BINARY_SNIFF_BYTES = 8192
const VERSIONS_SHOWN = 200
const MAX_LAST_CHANGES = 5000

/** Each stored version is read at most once per call, however many comparisons use it. */
function versionReader(storeDir: string): (id: string) => Promise<StoredVersion | null> {
  const loaded = new Map<string, Promise<StoredVersion | null>>()
  return (id) => {
    let pending = loaded.get(id)
    if (pending === undefined) {
      pending = readStoredVersion(storeDir, id)
      loaded.set(id, pending)
    }
    return pending
  }
}

function decodeText(bytes: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return null
  }
}

async function readPreviousVersion(storeDir: string, id: string): Promise<StoredVersion | null> {
  const ids = await readVersionIds(storeDir)
  const index = ids.indexOf(id)
  if (index === -1 || ids[index + 1] === undefined) {
    return null
  }
  return readStoredVersion(storeDir, ids[index + 1])
}

/** What a version changed against the one before it. */
export async function botTeamVersionChanges(
  deps: BotTeamSnapshotDeps,
  versionId: string
): Promise<BotTeamVersionChange[]> {
  return guarded(async () => {
    const version = await readStoredVersion(deps.storeDir, versionId)
    if (!version) {
      return []
    }
    const previous = await readPreviousVersion(deps.storeDir, versionId)
    return changesBetween(previous?.manifest.files ?? {}, version.manifest.files)
  })
}

/** Versions in which this file was added, changed or deleted, newest first. */
export async function botTeamFileVersions(
  deps: BotTeamSnapshotDeps,
  relativePath: string
): Promise<BotTeamFileVersion[]> {
  return guarded(async () => {
    const ids = await readVersionIds(deps.storeDir)
    const read = versionReader(deps.storeDir)
    const result: BotTeamFileVersion[] = []
    for (const [index, id] of ids.slice(0, VERSIONS_SHOWN).entries()) {
      const version = await read(id)
      if (!version) {
        continue
      }
      const previousId = ids[index + 1]
      const previous = previousId === undefined ? null : await read(previousId)
      const now = entryOf(version.manifest.files, relativePath)
      const before = previous ? entryOf(previous.manifest.files, relativePath) : undefined
      if (sameFile(before, now)) {
        continue
      }
      result.push({
        version: toBotTeamVersion(version),
        deleted: before !== undefined && now === undefined
      })
    }
    return result
  })
}

/** For each file, the id of the newest version that touched it. */
export async function botTeamLastVersionOfFile(
  deps: BotTeamSnapshotDeps
): Promise<Record<string, string>> {
  return guarded(async () => {
    const ids = await readVersionIds(deps.storeDir)
    const read = versionReader(deps.storeDir)
    const last = new Map<string, string>()
    for (const [index, id] of ids.slice(0, VERSIONS_SHOWN).entries()) {
      const version = await read(id)
      if (!version) {
        continue
      }
      const previousId = ids[index + 1]
      const previous = previousId === undefined ? null : await read(previousId)
      for (const change of changesBetween(previous?.manifest.files ?? {}, version.manifest.files)) {
        if (!last.has(change.path) && last.size < MAX_LAST_CHANGES) {
          last.set(change.path, version.id)
        }
      }
    }
    return Object.fromEntries(last)
  })
}

/**
 * A file as one version holds it. Text is read back only up to the preview size; binary and
 * larger text are described by their size, so nothing large is ever loaded whole.
 */
export async function readBotTeamVersionFile(
  deps: BotTeamSnapshotDeps,
  versionId: string,
  relativePath: string
): Promise<BotTeamVersionFile> {
  return guarded(async () => {
    const version = await readStoredVersion(deps.storeDir, versionId)
    const entry = version ? entryOf(version.manifest.files, relativePath) : undefined
    if (!entry) {
      return { kind: 'missing' as const }
    }
    const head = await readObjectHead(deps.storeDir, entry.hash, BINARY_SNIFF_BYTES)
    if (isBinaryBuffer(head)) {
      return { kind: 'binary' as const, size: entry.size }
    }
    if (entry.size > FILE_PREVIEW_BYTES) {
      return { kind: 'too-large' as const, size: entry.size }
    }
    const text = decodeText(await readFile(objectPath(deps.storeDir, entry.hash)))
    return text === null
      ? { kind: 'binary' as const, size: entry.size }
      : { kind: 'text' as const, text }
  })
}
