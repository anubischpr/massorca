// The bounded reads of a prototype request's files on the host, and the Gentle Shell design/ folder a
// request binds. Every read answers "absent" rather than throwing: a folder that is missing or
// unreadable holds nothing to list.

import type { Dirent } from 'node:fs'
import { lstat, readdir, readFile } from 'node:fs/promises'
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

/** The Gentle Shell set bound to a request: the one design/ folder new since the send, if exactly one. */
export async function gentleDesignSetFor(
  manifest: PrototypeRequestManifest
): Promise<PrototypeSet | null> {
  const cwd = manifest.sessionCwd
  if (manifest.agent !== 'gentle-shell' || cwd === undefined) {
    return null
  }
  const slug = resolveGentleDesignSlug(
    manifest.gentleDesignBaseline ?? [],
    await listGentleDesignSlugs(cwd)
  )
  if (slug === null) {
    return null
  }
  const designJson = await readBoundedJson(
    join(cwd, DESIGN_FOLDER, slug, DESIGN_MANIFEST_FILE),
    MAX_DESIGN_JSON_BYTES
  )
  return buildGentleDesignSet(manifest, slug, designJson)
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
  } catch {
    return null
  }
}

/** The entries of a folder; an absent or unreadable folder holds nothing to list. */
export async function readDirectoryEntries(folder: string): Promise<Dirent[]> {
  try {
    return await readdir(folder, { withFileTypes: true })
  } catch {
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
  } catch {
    return undefined
  }
}

async function isRegularFile(path: string): Promise<boolean> {
  return (await fileMtime(path)) !== null
}
