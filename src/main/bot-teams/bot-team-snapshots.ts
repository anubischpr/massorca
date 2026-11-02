import { randomUUID } from 'node:crypto'
import { access, lstat, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { gitOf, guarded, inLane, SnapshotFailure, toFailure } from './bot-team-snapshot-run'
import {
  BOT_TEAM_EMPTY_TREE,
  BOT_TEAM_SNAPSHOT_LIMITS,
  BOT_TEAM_VERSION_REF_PREFIX,
  type BotTeamSnapshotDeps,
  type BotTeamSnapshotInput,
  type BotTeamSnapshotLimits,
  type BotTeamSnapshotResult,
  type BotTeamVersion,
  type BotTeamVersionReason
} from './bot-team-snapshot-types'

/**
 * Versions of a team's folder. They live in a private Git repository outside the folder, so the
 * person's own repository, branches, index and working tree are never read or changed.
 */

const READ_BATCH = 64
const VERSIONS_SHOWN = 200
const AUTHOR_ENV = {
  GIT_AUTHOR_NAME: 'MassOrca',
  GIT_AUTHOR_EMAIL: 'bot-teams@massorca.invalid',
  GIT_COMMITTER_NAME: 'MassOrca',
  GIT_COMMITTER_EMAIL: 'bot-teams@massorca.invalid'
}

async function ensureRepository(deps: BotTeamSnapshotDeps): Promise<void> {
  try {
    await access(path.join(deps.gitDir, 'HEAD'))
    return
  } catch {
    // Not made yet.
  }
  await mkdir(path.dirname(deps.gitDir), { recursive: true })
  await gitOf(deps).text(['init', '--bare', deps.gitDir], { cwd: path.dirname(deps.gitDir) })
}

function oneLine(text: string): string {
  return (
    text
      .replace(/[\0\r\n]+/g, ' ')
      .trim()
      .slice(0, 120) || 'Saved'
  )
}

function parseReason(value: string): BotTeamVersionReason {
  return value === 'task-finished' || value === 'before-restore' || value === 'restored'
    ? value
    : 'other'
}

function parseVersions(listing: string): BotTeamVersion[] {
  return listing
    .split('\x02')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => {
      const [ref, commit, tree, seconds, ...rest] = record.split('\0')
      const [label = '', ...body] = rest.join('\0').split('\n')
      const field = (name: string): string =>
        body.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2) ?? ''
      return {
        id: ref.slice(BOT_TEAM_VERSION_REF_PREFIX.length),
        commit,
        tree,
        createdAt: Number(seconds) * 1000,
        reason: parseReason(field('reason')),
        label,
        skipped: Number(field('skipped')) || 0,
        author: field('author') || null
      }
    })
}

/** Newest first. */
export async function listBotTeamVersions(deps: BotTeamSnapshotDeps): Promise<BotTeamVersion[]> {
  return guarded(async () => {
    try {
      await access(path.join(deps.gitDir, 'HEAD'))
    } catch {
      return []
    }
    const listing = await gitOf(deps).text(
      [
        'for-each-ref',
        '--sort=-refname',
        `--count=${VERSIONS_SHOWN}`,
        '--format=%(refname)%00%(objectname)%00%(tree)%00%(committerdate:unix)%00%(contents)%02',
        BOT_TEAM_VERSION_REF_PREFIX
      ],
      { cwd: deps.folder }
    )
    return parseVersions(listing)
  })
}

async function savableFiles(
  deps: BotTeamSnapshotDeps,
  limits: BotTeamSnapshotLimits
): Promise<{ paths: string[]; skipped: number }> {
  const listing = await gitOf(deps).text(['ls-files', '-z', '--others', '--exclude-standard'], {
    cwd: deps.folder
  })
  const candidates = listing.split('\0').filter((entry) => entry.length > 0)
  const paths: string[] = []
  let skipped = 0
  let total = 0
  for (let start = 0; start < candidates.length; start += READ_BATCH) {
    const batch = candidates.slice(start, start + READ_BATCH)
    const stats = await Promise.all(
      batch.map((entry) =>
        // A trailing slash is a nested repository, which Git would only record as a link.
        entry.endsWith('/') ? null : lstat(path.join(deps.folder, entry)).catch(() => null)
      )
    )
    batch.forEach((entry, index) => {
      const stat = stats[index]
      if (!stat || !(stat.isFile() || stat.isSymbolicLink())) {
        return
      }
      if (stat.size > limits.maxFileBytes) {
        skipped += 1
        return
      }
      total += stat.size
      paths.push(entry)
    })
    if (paths.length > limits.maxFiles || total > limits.maxTotalBytes) {
      throw new SnapshotFailure('too-large', 'This folder is too large to save as a version.')
    }
  }
  return { paths, skipped }
}

/** Callers hold the team's lane, so the next number cannot be taken by another save. */
export async function saveBotTeamSnapshot(
  deps: BotTeamSnapshotDeps,
  input: BotTeamSnapshotInput
): Promise<{ version: BotTeamVersion | null; unchanged: boolean }> {
  await ensureRepository(deps)
  const git = gitOf(deps)
  const { paths, skipped } = await savableFiles(deps, deps.limits ?? BOT_TEAM_SNAPSHOT_LIMITS)
  const indexFile = path.join(deps.gitDir, `index.${randomUUID()}`)
  try {
    if (paths.length > 0) {
      await git.text(['update-index', '--add', '--remove', '-z', '--stdin'], {
        cwd: deps.folder,
        indexFile,
        stdin: `${paths.join('\0')}\0`
      })
    }
    const tree = (await git.text(['write-tree'], { cwd: deps.folder, indexFile })).trim()
    const latest = (await listBotTeamVersions(deps))[0]
    if (latest ? latest.tree === tree : tree === BOT_TEAM_EMPTY_TREE) {
      return { version: latest ?? null, unchanged: true }
    }
    const seconds = Math.floor((deps.now ?? Date.now)() / 1000)
    const author = input.author ? `author: ${oneLine(input.author)}\n` : ''
    const message = `${oneLine(input.label)}\n\nreason: ${input.reason}\nskipped: ${skipped}\n${author}`
    const commit = (
      await git.text(
        ['commit-tree', tree, ...(latest ? ['-p', latest.commit] : []), '-m', message],
        {
          cwd: deps.folder,
          env: {
            ...AUTHOR_ENV,
            GIT_AUTHOR_DATE: `${seconds} +0000`,
            GIT_COMMITTER_DATE: `${seconds} +0000`
          }
        }
      )
    ).trim()
    const id = String(latest ? Number(latest.id) + 1 : 1).padStart(6, '0')
    // The empty old value makes a name that already exists fail instead of being replaced.
    await git.text(['update-ref', `${BOT_TEAM_VERSION_REF_PREFIX}${id}`, commit, ''], {
      cwd: deps.folder
    })
    const saved = (await listBotTeamVersions(deps)).find((version) => version.id === id)
    return { version: saved ?? null, unchanged: false }
  } finally {
    await rm(indexFile, { force: true })
  }
}

/** Saves the folder as a new version, unless nothing changed since the last one. */
export function takeBotTeamSnapshot(
  deps: BotTeamSnapshotDeps,
  input: BotTeamSnapshotInput
): Promise<BotTeamSnapshotResult> {
  return inLane(deps.gitDir, async () => {
    try {
      const saved = await guarded(() => saveBotTeamSnapshot(deps, input))
      return { ok: true as const, ...saved }
    } catch (error) {
      const failure = toFailure(error)
      return { ok: false as const, reason: failure.reason, message: failure.message }
    }
  })
}
