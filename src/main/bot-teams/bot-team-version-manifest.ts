import { createHash, randomUUID } from 'node:crypto'
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isMissingFile, TEMP_DIR, VERSIONS_DIR } from './bot-team-content-store'
import { SnapshotFailure } from './bot-team-snapshot-run'
import type {
  BotTeamVersion,
  BotTeamVersionChange,
  BotTeamVersionReason
} from './bot-team-snapshot-types'

/** One file as a version holds it: the sha256 of its bytes and its size. */
export type StoredFile = { hash: string; size: number }

/** What a version file records on disk. */
export type StoredManifest = {
  id: string
  createdAt: number
  reason: BotTeamVersionReason
  label: string
  author: string | null
  skipped: number
  files: Record<string, StoredFile>
}

/** A version as read from disk, with the sha256 of its manifest bytes. */
export type StoredVersion = { id: string; digest: string; manifest: StoredManifest }

const VERSION_ID = /^\d{6,}$/
const MANIFEST_SUFFIX = '.json'

export function isVersionId(id: string): boolean {
  return VERSION_ID.test(id)
}

export function formatVersionId(number: number): string {
  return String(number).padStart(6, '0')
}

function manifestPath(storeDir: string, id: string): string {
  return path.join(storeDir, VERSIONS_DIR, `${id}${MANIFEST_SUFFIX}`)
}

function digestOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Version ids that exist, newest first. */
export async function readVersionIds(storeDir: string): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(path.join(storeDir, VERSIONS_DIR))
  } catch (error) {
    if (isMissingFile(error)) {
      return []
    }
    throw error
  }
  return names
    .filter((name) => name.endsWith(MANIFEST_SUFFIX))
    .map((name) => name.slice(0, -MANIFEST_SUFFIX.length))
    .filter(isVersionId)
    .sort((a, b) => Number(b) - Number(a))
}

/** A saved version, or null when there is no such version. */
export async function readStoredVersion(
  storeDir: string,
  id: string
): Promise<StoredVersion | null> {
  if (!isVersionId(id)) {
    return null
  }
  let bytes: Buffer
  try {
    bytes = await readFile(manifestPath(storeDir, id))
  } catch (error) {
    if (isMissingFile(error)) {
      return null
    }
    throw error
  }
  return { id, digest: digestOf(bytes), manifest: parseManifest(bytes.toString('utf8'), id) }
}

/** The manifest goes last, through a temporary file, so a version never points at missing files. */
export async function writeStoredVersion(
  storeDir: string,
  manifest: StoredManifest
): Promise<StoredVersion> {
  const bytes = Buffer.from(JSON.stringify(manifest), 'utf8')
  const temp = path.join(storeDir, TEMP_DIR, randomUUID())
  try {
    await writeFile(temp, bytes)
    await rename(temp, manifestPath(storeDir, manifest.id))
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
  return { id: manifest.id, digest: digestOf(bytes), manifest }
}

function damagedVersion(): SnapshotFailure {
  return new SnapshotFailure('failed', 'A saved version is damaged.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function storedFileOf(value: unknown): StoredFile {
  if (isRecord(value) && typeof value.hash === 'string' && typeof value.size === 'number') {
    return { hash: value.hash, size: value.size }
  }
  throw damagedVersion()
}

function parseReason(value: unknown): BotTeamVersionReason {
  return value === 'task-finished' || value === 'before-restore' || value === 'restored'
    ? value
    : 'other'
}

function parseManifest(text: string, id: string): StoredManifest {
  const value: unknown = JSON.parse(text)
  if (!isRecord(value) || value.id !== id || typeof value.createdAt !== 'number') {
    throw damagedVersion()
  }
  const { label, skipped, author, reason, files } = value
  if (typeof label !== 'string' || typeof skipped !== 'number' || !isRecord(files)) {
    throw damagedVersion()
  }
  return {
    id,
    createdAt: value.createdAt,
    reason: parseReason(reason),
    label,
    author: typeof author === 'string' ? author : null,
    skipped,
    files: Object.fromEntries(
      Object.entries(files).map(([relativePath, entry]) => [relativePath, storedFileOf(entry)])
    )
  }
}

/** A version as the screens show it; commit and tree both carry the manifest's sha256. */
export function toBotTeamVersion(stored: StoredVersion): BotTeamVersion {
  const { manifest } = stored
  return {
    id: stored.id,
    commit: stored.digest,
    tree: stored.digest,
    createdAt: manifest.createdAt,
    reason: manifest.reason,
    label: manifest.label,
    skipped: manifest.skipped,
    author: manifest.author
  }
}

/** The entry for one path, looking only at the files a version lists (never inherited keys). */
export function entryOf(
  files: Record<string, StoredFile>,
  relativePath: string
): StoredFile | undefined {
  return Object.hasOwn(files, relativePath) ? files[relativePath] : undefined
}

export function sameFile(before: StoredFile | undefined, after: StoredFile | undefined): boolean {
  if (before === undefined || after === undefined) {
    return before === after
  }
  return before.hash === after.hash
}

/** What changed from `before` to `after`, by path. */
export function changesBetween(
  before: Record<string, StoredFile>,
  after: Record<string, StoredFile>
): BotTeamVersionChange[] {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  const changes: BotTeamVersionChange[] = []
  for (const relativePath of paths) {
    const was = entryOf(before, relativePath)
    const now = entryOf(after, relativePath)
    if (was && now) {
      if (was.hash !== now.hash) {
        changes.push({ status: 'modified', path: relativePath })
      }
    } else if (now) {
      changes.push({ status: 'added', path: relativePath })
    } else if (was) {
      changes.push({ status: 'deleted', path: relativePath })
    }
  }
  return changes
}
