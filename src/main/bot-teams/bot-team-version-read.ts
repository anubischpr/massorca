import { gitOf, guarded } from './bot-team-snapshot-run'
import { listBotTeamVersions } from './bot-team-snapshots'
import type {
  BotTeamSnapshotDeps,
  BotTeamVersion,
  BotTeamVersionChange,
  BotTeamVersionFile
} from './bot-team-snapshot-types'

const FILE_PREVIEW_BYTES = 1024 * 1024

export function parseBotTeamVersionChanges(output: string): BotTeamVersionChange[] {
  const fields = output.split('\0').filter((field) => field.length > 0)
  const changes: BotTeamVersionChange[] = []
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const code = fields[index][0]
    changes.push({
      status: code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified',
      path: fields[index + 1]
    })
  }
  return changes
}

export function findBotTeamVersion(
  versions: BotTeamVersion[],
  id: string
): BotTeamVersion | undefined {
  return versions.find((version) => version.id === id)
}

/** What a version changed against the one before it. */
export async function botTeamVersionChanges(
  deps: BotTeamSnapshotDeps,
  versionId: string
): Promise<BotTeamVersionChange[]> {
  return guarded(async () => {
    const version = findBotTeamVersion(await listBotTeamVersions(deps), versionId)
    if (!version) {
      return []
    }
    const output = await gitOf(deps).text(
      ['diff-tree', '-r', '--root', '--no-renames', '--name-status', '-z', version.commit],
      { cwd: deps.folder }
    )
    // With one commit named, diff-tree prints that commit's id first.
    return parseBotTeamVersionChanges(output.slice(output.indexOf('\0') + 1))
  })
}

/** Versions in which this file was added, changed or deleted, newest first. */
export async function botTeamFileVersions(
  deps: BotTeamSnapshotDeps,
  relativePath: string
): Promise<BotTeamVersion[]> {
  return guarded(async () => {
    const versions = await listBotTeamVersions(deps)
    if (versions.length === 0) {
      return []
    }
    const output = await gitOf(deps).text(
      ['--literal-pathspecs', 'log', '-z', '--format=%H', versions[0].commit, '--', relativePath],
      { cwd: deps.folder }
    )
    const touched = new Set(output.split('\0').filter((entry) => entry.length > 0))
    return versions.filter((version) => touched.has(version.commit))
  })
}

/** A file as one version holds it; text only up to a preview size. */
export async function readBotTeamVersionFile(
  deps: BotTeamSnapshotDeps,
  versionId: string,
  relativePath: string
): Promise<BotTeamVersionFile> {
  return guarded(async () => {
    const version = findBotTeamVersion(await listBotTeamVersions(deps), versionId)
    if (!version) {
      return { kind: 'missing' as const }
    }
    const git = gitOf(deps)
    const spec = `${version.tree}:${relativePath}`
    let size: number
    try {
      size = Number((await git.text(['cat-file', '-s', spec], { cwd: deps.folder })).trim())
    } catch {
      return { kind: 'missing' as const }
    }
    if (size > FILE_PREVIEW_BYTES) {
      return { kind: 'too-large' as const }
    }
    const bytes = await git.bytes(['cat-file', 'blob', spec], { cwd: deps.folder })
    // Git's own test for a binary file: a zero byte near the start.
    return bytes.subarray(0, 8000).includes(0)
      ? { kind: 'binary' as const }
      : { kind: 'text' as const, text: bytes.toString('utf-8') }
  })
}
