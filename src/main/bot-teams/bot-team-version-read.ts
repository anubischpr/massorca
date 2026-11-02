import type { BotTeamFileVersion } from '../../shared/rpc-contract/bot-team-version-params'
import { gitOf, guarded } from './bot-team-snapshot-run'
import { listBotTeamVersions } from './bot-team-snapshots'
import type {
  BotTeamSnapshotDeps,
  BotTeamVersion,
  BotTeamVersionChange,
  BotTeamVersionFile
} from './bot-team-snapshot-types'

const FILE_PREVIEW_BYTES = 1024 * 1024
const MAX_LAST_CHANGES = 5000

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
): Promise<BotTeamFileVersion[]> {
  return guarded(async () => {
    const versions = await listBotTeamVersions(deps)
    if (versions.length === 0) {
      return []
    }
    const log = async (...extra: string[]): Promise<Set<string>> => {
      const output = await gitOf(deps).text(
        [
          '--literal-pathspecs',
          'log',
          '-z',
          '--format=%H',
          ...extra,
          versions[0].commit,
          '--',
          relativePath
        ],
        { cwd: deps.folder }
      )
      return new Set(output.split('\0').filter((entry) => entry.length > 0))
    }
    const [touched, deleted] = await Promise.all([log(), log('--diff-filter=D')])
    return versions
      .filter((version) => touched.has(version.commit))
      .map((version) => ({ version, deleted: deleted.has(version.commit) }))
  })
}

/** For each file, the id of the newest version that touched it. */
export async function botTeamLastVersionOfFile(
  deps: BotTeamSnapshotDeps
): Promise<Record<string, string>> {
  return guarded(async () => {
    const versions = await listBotTeamVersions(deps)
    if (versions.length === 0) {
      return {}
    }
    const idByCommit = new Map(versions.map((version) => [version.commit, version.id]))
    const output = await gitOf(deps).text(
      ['log', '--no-renames', '--format=%x01%H', '--name-only', versions[0].commit],
      { cwd: deps.folder }
    )
    const last: Record<string, string> = {}
    let count = 0
    for (const record of output.split('\x01')) {
      const [commit, ...names] = record.split('\n')
      const id = idByCommit.get(commit.trim())
      for (const name of names) {
        // Git quotes a name that holds a quote, a backslash or a control character; those are left out.
        if (id && name && !name.startsWith('"') && !(name in last) && count < MAX_LAST_CHANGES) {
          last[name] = id
          count += 1
        }
      }
    }
    return last
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
