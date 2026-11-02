import { randomUUID } from 'node:crypto'
import { rm, rmdir } from 'node:fs/promises'
import path from 'node:path'
import { gitOf, guarded, inLane, toFailure } from './bot-team-snapshot-run'
import { listBotTeamVersions, saveBotTeamSnapshot } from './bot-team-snapshots'
import { findBotTeamVersion, parseBotTeamVersionChanges } from './bot-team-version-read'
import {
  BOT_TEAM_EMPTY_TREE,
  type BotTeamRestoreResult,
  type BotTeamSnapshotDeps,
  type BotTeamVersion
} from './bot-team-snapshot-types'

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

async function applyVersion(
  deps: BotTeamSnapshotDeps,
  fromTree: string,
  target: BotTeamVersion
): Promise<void> {
  const git = gitOf(deps)
  const output = await git.text(
    ['diff-tree', '-r', '--no-renames', '--name-status', '-z', fromTree, target.tree],
    { cwd: deps.folder }
  )
  const changes = parseBotTeamVersionChanges(output)
  for (const change of changes.filter((entry) => entry.status === 'deleted')) {
    const file = insideFolder(deps.folder, change.path)
    if (file) {
      await rm(file, { force: true })
      await removeEmptyParents(deps.folder, file)
    }
  }
  await writeFilesFromTree(
    deps,
    target.tree,
    changes.filter((entry) => entry.status !== 'deleted').map((entry) => entry.path)
  )
}

async function writeFilesFromTree(
  deps: BotTeamSnapshotDeps,
  tree: string,
  paths: string[]
): Promise<void> {
  const toWrite = paths.filter((entry) => insideFolder(deps.folder, entry))
  if (toWrite.length === 0) {
    return
  }
  const git = gitOf(deps)
  const indexFile = path.join(deps.gitDir, `index.${randomUUID()}`)
  try {
    await git.text(['read-tree', tree], { cwd: deps.folder, indexFile })
    await git.text(['checkout-index', '-f', '-z', '--stdin'], {
      cwd: deps.folder,
      indexFile,
      stdin: `${toWrite.join('\0')}\0`
    })
  } finally {
    await rm(indexFile, { force: true })
  }
}

/** One file goes back to how a version held it; the rest of the folder stays as it is. */
export function restoreBotTeamFile(
  deps: BotTeamSnapshotDeps,
  versionId: string,
  relativePath: string
): Promise<BotTeamRestoreResult> {
  return inLane(deps.gitDir, async () => {
    try {
      const target = findBotTeamVersion(await listBotTeamVersions(deps), versionId)
      if (!target || !insideFolder(deps.folder, relativePath)) {
        return {
          ok: false as const,
          reason: 'missing-version' as const,
          message: 'No such version.'
        }
      }
      const held = await guarded(() =>
        gitOf(deps)
          .text(['cat-file', '-e', `${target.tree}:${relativePath}`], { cwd: deps.folder })
          .then(
            () => true,
            () => false
          )
      )
      if (!held) {
        return {
          ok: false as const,
          reason: 'missing-version' as const,
          message: 'That version has no such file.'
        }
      }
      const saved = await guarded(() =>
        saveBotTeamSnapshot(deps, { reason: 'before-restore', label: 'Before restoring' })
      )
      await guarded(() => writeFilesFromTree(deps, target.tree, [relativePath]))
      await guarded(() => saveBotTeamSnapshot(deps, { reason: 'restored', label: 'Restored' }))
      return {
        ok: true as const,
        restoredFrom: target,
        savedBefore: saved.unchanged ? null : saved.version
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
  return inLane(deps.gitDir, async () => {
    try {
      const target = findBotTeamVersion(await listBotTeamVersions(deps), versionId)
      if (!target) {
        return {
          ok: false as const,
          reason: 'missing-version' as const,
          message: 'No such version.'
        }
      }
      const saved = await guarded(() =>
        saveBotTeamSnapshot(deps, { reason: 'before-restore', label: 'Before restoring' })
      )
      await guarded(() => applyVersion(deps, saved.version?.tree ?? BOT_TEAM_EMPTY_TREE, target))
      await guarded(() => saveBotTeamSnapshot(deps, { reason: 'restored', label: 'Restored' }))
      return {
        ok: true as const,
        restoredFrom: target,
        savedBefore: saved.unchanged ? null : saved.version
      }
    } catch (error) {
      const failure = toFailure(error)
      return { ok: false as const, reason: failure.reason, message: failure.message }
    }
  })
}
