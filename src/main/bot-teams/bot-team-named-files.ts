import { accessSync, constants, lstatSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { MAX_FILE_BYTES } from './bot-team-deliverables'
import type { DeliverableFile } from './bot-team-deliverables-copyable'
import { isSecretLikeName } from './bot-team-workspace-scan'

/** A folder a message may name a file in, and the folder names a file under it must not sit in. */
export type NamedFileRoot = { path: string; skipFolders: ReadonlySet<string> }

type ResolvedRoot = NamedFileRoot & { real: string }

// An absolute Windows (`C:\...`) or POSIX (`/...`) path; a URL's `//` and a relative path do not match.
const ABSOLUTE_PATH = /(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"'`<>|*?]+|(?<![\w:./\\])\/[^\s"'`<>|*?]+/g
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>]+$/
const MAX_NAMED_PATHS = 20

/**
 * The readable files a message names by absolute path, each inside one of the roots. A path that
 * leaves its root through a link, names a dot entry or a credential-like file, or sits in a folder
 * its root skips, is refused.
 */
export function namedFilesIn(text: string, roots: readonly NamedFileRoot[]): DeliverableFile[] {
  const candidates = new Set(
    [...text.matchAll(ABSOLUTE_PATH)].map((match) => match[0].replace(TRAILING_PUNCTUATION, ''))
  )
  return namedFilesAmong([...candidates], roots)
}

/** The same rules for paths already split out, such as the files a finished task listed. */
export function namedFilesAmong(
  candidates: readonly string[],
  roots: readonly NamedFileRoot[]
): DeliverableFile[] {
  const resolved = roots.flatMap((root): ResolvedRoot[] => {
    try {
      return [{ ...root, real: realpathSync(root.path) }]
    } catch {
      return []
    }
  })
  const named: DeliverableFile[] = []
  for (const candidate of candidates.slice(0, MAX_NAMED_PATHS)) {
    const file = namedFileIn(candidate, resolved)
    if (file !== null) {
      named.push(file)
    }
  }
  return named
}

function namedFileIn(candidate: string, roots: readonly ResolvedRoot[]): DeliverableFile | null {
  if (!path.isAbsolute(candidate)) {
    return null
  }
  const target = path.resolve(candidate)
  let real: string
  try {
    if (lstatSync(target).isSymbolicLink()) {
      return null
    }
    real = realpathSync(target)
    const stat = statSync(real)
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
      return null
    }
    accessSync(real, constants.R_OK)
  } catch {
    // Why: a path that cannot be read names nothing this task can hand over.
    return null
  }
  for (const root of roots) {
    const relative = path.relative(root.real, real)
    const inside =
      relative !== '' &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    if (!inside) {
      continue
    }
    const parts = relative.split(path.sep)
    const refused =
      parts.some((part) => part.startsWith('.')) ||
      isSecretLikeName(parts.at(-1) ?? '') ||
      parts.slice(0, -1).some((part) => root.skipFolders.has(part))
    return refused ? null : { root: root.path, relative: parts.join('/') }
  }
  return null
}
