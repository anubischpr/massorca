// The bounded reads of a prototype request's files on the host, and the Gentle Shell design/ folder a
// request binds. Every read answers "absent" rather than throwing: a folder that is missing or
// unreadable holds nothing to list.

import type { Dirent } from 'node:fs'
import { lstat, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  isPlainPathSegment,
  PROTOTYPE_MANIFEST_FILE_NAME
} from '../../shared/prototype-request-folder'
import {
  buildGentleDesignSet,
  parsePrototypeRequestManifest,
  resolveGentleDesignSlug,
  type PrototypeRequestManifest,
  type PrototypeSet
} from '../../shared/prototype-sets'

export const MAX_MANIFEST_BYTES = 256 * 1024
const MAX_DESIGN_JSON_BYTES = 256 * 1024
// Why a bound: the scan runs on every Prototypes open; a folder with thousands of entries must not stall it.
const MAX_DESIGN_SLUGS_CONSIDERED = 500
export const DESIGN_FOLDER = 'design'
const DESIGN_MANIFEST_FILE = 'design.json'

/** The request.json of a request folder, or null when it is absent, oversized or not a valid manifest. */
export async function readRequestManifest(
  requestFolder: string
): Promise<PrototypeRequestManifest | null> {
  return parsePrototypeRequestManifest(
    await readBoundedJson(join(requestFolder, PROTOTYPE_MANIFEST_FILE_NAME), MAX_MANIFEST_BYTES)
  )
}

/**
 * The Gentle Shell set bound to a request, read under the chat's own launch directory. request.json sits in
 * the folder the agent writes into, so its `sessionCwd` counts only when it names that directory, and a slug
 * already in it only when it was not a design folder at the send. The slug is bound on first resolution and
 * kept in request.json, so a design folder that appears later cannot rebind the request.
 */
export async function gentleDesignSetFor(
  requestFolder: string,
  manifest: PrototypeRequestManifest,
  launchDirectory: string | undefined
): Promise<PrototypeSet | null> {
  if (
    manifest.agent !== 'gentle-shell' ||
    launchDirectory === undefined ||
    manifest.sessionCwd !== launchDirectory
  ) {
    return null
  }
  const slug =
    manifest.gentleDesignSlug === undefined
      ? await resolveAndBindSlug(requestFolder, manifest, launchDirectory)
      : keptBoundSlug(manifest)
  if (slug === null) {
    return null
  }
  const designJson = await readBoundedJson(
    join(launchDirectory, DESIGN_FOLDER, slug, DESIGN_MANIFEST_FILE),
    MAX_DESIGN_JSON_BYTES
  )
  return buildGentleDesignSet(manifest, slug, designJson)
}

// A slug already in request.json counts only when it was not a design folder that existed at the send.
function keptBoundSlug(manifest: PrototypeRequestManifest): string | null {
  const slug = manifest.gentleDesignSlug ?? null
  return slug === null || (manifest.gentleDesignBaseline ?? []).includes(slug) ? null : slug
}

/** The one design/ folder new since the send, bound into request.json; null while there is not exactly one, or the binding is not kept. */
async function resolveAndBindSlug(
  requestFolder: string,
  manifest: PrototypeRequestManifest,
  cwd: string
): Promise<string | null> {
  const slug = resolveGentleDesignSlug(
    manifest.gentleDesignBaseline ?? [],
    await listGentleDesignSlugs(cwd)
  )
  if (slug === null) {
    return null
  }
  // Why: a binding that is not kept would let a later design folder rebind the request, so no set is shown.
  const kept = await writeRequestManifest(requestFolder, { ...manifest, gentleDesignSlug: slug })
  return kept ? slug : null
}

/** Rewrites request.json through a temporary file, so a reader never sees a half-written manifest; false when it could not. */
async function writeRequestManifest(
  requestFolder: string,
  manifest: PrototypeRequestManifest
): Promise<boolean> {
  const path = join(requestFolder, PROTOTYPE_MANIFEST_FILE_NAME)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(manifest, null, 2))
    await rename(temporary, path)
    return true
  } catch (error) {
    logPrototypeFailure('writing a prototype request manifest', error)
    await unlink(temporary).catch(() => undefined)
    return false
  }
}

/** Keeps the design system version a request was first seen built on in its request.json; false when it could not be written. */
export function recordRequestDesignSystemVersion(
  requestFolder: string,
  manifest: PrototypeRequestManifest,
  version: number
): Promise<boolean> {
  return writeRequestManifest(requestFolder, { ...manifest, designSystemVersion: version })
}

/** Logs a failure other than an absent file, which is the normal state of a folder that holds nothing. */
export function logPrototypeFailure(action: string, error: unknown): void {
  const code = errorCode(error)
  if (code !== 'ENOENT') {
    console.warn(`[prototypes] ${action} failed${code === undefined ? '' : `: ${code}`}`)
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

/** The direct subfolders of design/ that hold a design.json, sorted. */
export async function listGentleDesignSlugs(sessionCwd: string): Promise<string[]> {
  const designFolder = join(sessionCwd, DESIGN_FOLDER)
  const slugs: string[] = []
  for (const entry of (await readDirectoryEntries(designFolder)).slice(
    0,
    MAX_DESIGN_SLUGS_CONSIDERED
  )) {
    if (
      entry.isDirectory() &&
      isPlainPathSegment(entry.name) &&
      (await isRegularFile(join(designFolder, entry.name, DESIGN_MANIFEST_FILE)))
    ) {
      slugs.push(entry.name)
    }
  }
  return slugs.sort()
}

/** The names of the regular files directly in a folder. */
export async function fileNamesIn(folder: string): Promise<string[]> {
  return (await readDirectoryEntries(folder))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
}

/** The last write time of a regular file in milliseconds, or null when it is not one. */
export async function fileMtime(path: string): Promise<number | null> {
  try {
    const stats = await lstat(path)
    return stats.isFile() ? stats.mtimeMs : null
  } catch (error) {
    logPrototypeFailure('reading a prototype file', error)
    return null
  }
}

/** The entries of a folder; an absent folder holds nothing to list, and any other failure is logged. */
export async function readDirectoryEntries(folder: string): Promise<Dirent[]> {
  try {
    return await readdir(folder, { withFileTypes: true })
  } catch (error) {
    logPrototypeFailure('listing a prototype folder', error)
    return []
  }
}

/** The parsed JSON of a small regular file, or undefined when it is absent, large or not JSON. */
async function readBoundedJson(path: string, maxBytes: number): Promise<unknown> {
  try {
    const stats = await lstat(path)
    if (!stats.isFile() || stats.size > maxBytes) {
      return undefined
    }
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    return parsed
  } catch (error) {
    logPrototypeFailure('reading a prototype JSON file', error)
    return undefined
  }
}

async function isRegularFile(path: string): Promise<boolean> {
  return (await fileMtime(path)) !== null
}
