import { lstatSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { BOT_TEAM_ROOM_ATTACHMENT_LIMIT } from '../../shared/bot-team-room-attachments'
import { MAX_FILE_BYTES } from './bot-team-deliverables'

/** Folders a task's files are never read from: dependencies, build output and caches. */
export const SKIPPED_WORKSPACE_FOLDERS: ReadonlySet<string> = new Set([
  'node_modules',
  'out',
  'dist',
  'build',
  'target',
  'coverage'
])

const MAX_DEPTH = 8
/** The entries one scan reads at most, so a large checkout cannot hold up a finish. */
const MAX_ENTRIES = 20_000
const MAX_SCANNED_BYTES = 100 * 1024 * 1024
// The filesystem's time can trail the host's clock a little.
const CLOCK_SLACK_MS = 1000
const SECRET_LIKE_NAME =
  /secret|credential|password|\.(pem|key|p12|pfx)$|^id_(rsa|dsa|ecdsa|ed25519)/i

/** A name that looks like a credential: such a file is never handed to the room. */
export function isSecretLikeName(name: string): boolean {
  return SECRET_LIKE_NAME.test(name)
}

type ScannedFile = { relative: string; mtimeMs: number; size: number }

/**
 * The regular files under a workspace folder written since a task began, newest first, leaving out
 * `excluded` (the names git tracks, whose changes git lists itself). Dot entries, links, build output
 * and secret-looking names are skipped; the walk reads at most MAX_ENTRIES entries and the result holds
 * at most the attachment limit.
 */
export function listRecentWorkspaceFiles(
  folder: string,
  sinceMs: number,
  excluded: ReadonlySet<string> = new Set()
): string[] {
  const found: ScannedFile[] = []
  const pending: { directory: string; depth: number }[] = [{ directory: folder, depth: 0 }]
  let visited = 0
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    for (const entry of readEntries(next.directory)) {
      if (visited >= MAX_ENTRIES) {
        return pickNewest(found)
      }
      visited += 1
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
        continue
      }
      const full = path.join(next.directory, entry.name)
      if (entry.isDirectory()) {
        if (
          next.depth < MAX_DEPTH &&
          !SKIPPED_WORKSPACE_FOLDERS.has(entry.name) &&
          !isLinkEntry(full)
        ) {
          pending.push({ directory: full, depth: next.depth + 1 })
        }
      } else if (entry.isFile()) {
        const file = recentFile(folder, full, sinceMs)
        if (file !== null && !excluded.has(file.relative)) {
          found.push(file)
        }
      }
    }
  }
  return pickNewest(found)
}

/**
 * True for a repository's own checkout, whose `.git` is a folder: its files are its owner's work,
 * so they are never listed by time. A linked worktree keeps a `.git` file instead.
 */
export function isGitMainCheckout(folder: string): boolean {
  try {
    return lstatSync(path.join(folder, '.git')).isDirectory()
  } catch {
    return false
  }
}

// Why: a directory junction reports as a directory to readdir, but it leads outside the workspace.
function isLinkEntry(full: string): boolean {
  try {
    return lstatSync(full).isSymbolicLink()
  } catch {
    return true
  }
}

function readEntries(directory: string) {
  try {
    return readdirSync(directory, { withFileTypes: true })
  } catch {
    // Why: a folder that cannot be read holds nothing this task can hand over.
    return []
  }
}

function recentFile(folder: string, full: string, sinceMs: number): ScannedFile | null {
  if (isSecretLikeName(path.basename(full))) {
    return null
  }
  try {
    const stat = statSync(full)
    if (stat.mtimeMs < sinceMs - CLOCK_SLACK_MS || stat.size > MAX_FILE_BYTES) {
      return null
    }
    return {
      relative: path.relative(folder, full).split(path.sep).join('/'),
      mtimeMs: stat.mtimeMs,
      size: stat.size
    }
  } catch {
    // Why: a file removed while the folder is read is nothing to hand over.
    return null
  }
}

function pickNewest(found: readonly ScannedFile[]): string[] {
  const picked: string[] = []
  let bytes = 0
  for (const file of [...found].sort((left, right) => right.mtimeMs - left.mtimeMs)) {
    if (picked.length >= BOT_TEAM_ROOM_ATTACHMENT_LIMIT) {
      break
    }
    if (bytes + file.size <= MAX_SCANNED_BYTES) {
      picked.push(file.relative)
      bytes += file.size
    }
  }
  return picked
}
