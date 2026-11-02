import {
  botTeamGroupProjectKey,
  botTeamRepoProjectKey,
  parseBotTeamProjectKey
} from '../../shared/bot-team-project-workspace-key'
import { isBotTeamFolderPath } from '../../shared/bot-team-folder'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import { projectGroupIdFromRepoId } from '../../shared/folder-workspace-worktree'
import type { ProjectGroup } from '../../shared/project-group-types'
import { isFolderRepo } from '../../shared/repo-kind'
import type { Repo } from '../../shared/repo-types'
import type { BotTeamLinkableWorkspace } from '../../shared/rpc-contract/bot-team-room-params'
import type { Worktree } from '../../shared/worktree/types'
import { folderWorkspaceKey, parseWorkspaceKey } from '../../shared/workspace-scope'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'

/** Why: a capped page would hide workspaces from the picker, so every row is read. */
const EVERY_ROW_LIMIT = Number.MAX_SAFE_INTEGER

/** What the listing reads from the host; the same calls worktree.list and folderWorkspace.list make. */
export type WorkspaceProjectSource = {
  listRepos: () => readonly Pick<Repo, 'id' | 'kind' | 'path' | 'displayName' | 'repoIcon'>[]
  listWorktreeRows: () => Promise<readonly Pick<Worktree, 'id' | 'repoId' | 'path'>[]>
  listProjectGroups: () => readonly Pick<ProjectGroup, 'id' | 'name'>[]
  listFolderWorkspaces: () => readonly FolderWorkspace[]
}

export function workspaceProjectSource(
  runtime: Pick<
    OrcaRuntimeService,
    'listRepos' | 'listManagedWorktrees' | 'listProjectGroups' | 'listFolderWorkspaces'
  >
): WorkspaceProjectSource {
  return {
    listRepos: () => runtime.listRepos(),
    listWorktreeRows: async () =>
      (await runtime.listManagedWorktrees(undefined, EVERY_ROW_LIMIT)).worktrees,
    listProjectGroups: () => runtime.listProjectGroups(),
    listFolderWorkspaces: () => runtime.listFolderWorkspaces()
  }
}

/** Where a project's tasks run: a git repo gets a child worktree each, a folder runs in place. */
export type WorkspaceProjectHome =
  | { type: 'repo'; repoId: string; mainWorktreeId: string | null }
  | { type: 'folder'; workspaceId: string }

export type WorkspaceProject = { entry: BotTeamLinkableWorkspace; home: WorkspaceProjectHome }

type Snapshot = {
  repos: ReturnType<WorkspaceProjectSource['listRepos']>
  rows: Awaited<ReturnType<WorkspaceProjectSource['listWorktreeRows']>>
  folders: readonly FolderWorkspace[]
  projects: WorkspaceProject[]
}

/** The checkout a folder repo (or a repo's main branch) lives in: its row at the repo's own path. */
function mainRowOf(
  repo: Pick<Repo, 'id' | 'path'>,
  rows: Snapshot['rows']
): Snapshot['rows'][number] | undefined {
  const own = rows.filter((row) => row.repoId === repo.id)
  return own.find((row) => row.path === repo.path) ?? own[0]
}

function projectsOf(
  source: WorkspaceProjectSource,
  repos: Snapshot['repos'],
  rows: Snapshot['rows'],
  folders: readonly FolderWorkspace[]
): WorkspaceProject[] {
  const found: WorkspaceProject[] = []
  for (const repo of repos) {
    if (isBotTeamFolderPath(repo.path)) {
      continue
    }
    const main = mainRowOf(repo, rows)
    const isFolder = isFolderRepo(repo)
    found.push({
      entry: {
        key: botTeamRepoProjectKey(repo.id),
        name: repo.displayName.trim() || repo.id,
        kind: isFolder ? 'folder' : 'git',
        ...(repo.repoIcon ? { icon: repo.repoIcon } : {})
      },
      home: isFolder
        ? { type: 'folder', workspaceId: main?.id ?? `${repo.id}::${repo.path}` }
        : { type: 'repo', repoId: repo.id, mainWorktreeId: main?.id ?? null }
    })
  }
  for (const group of source.listProjectGroups()) {
    // Why: the most recent folder of the group stands in for it; a team's own folder never counts.
    const folder = folders
      .filter(
        (entry) =>
          entry.projectGroupId === group.id &&
          !entry.isArchived &&
          !isBotTeamFolderPath(entry.folderPath)
      )
      .sort((left, right) => right.lastActivityAt - left.lastActivityAt)[0]
    if (folder) {
      found.push({
        entry: {
          key: botTeamGroupProjectKey(group.id),
          name: group.name.trim() || group.id,
          kind: 'folder'
        },
        home: { type: 'folder', workspaceId: folderWorkspaceKey(folder.id) }
      })
    }
  }
  return found.sort(
    (left, right) =>
      left.entry.name.localeCompare(right.entry.name) ||
      left.entry.key.localeCompare(right.entry.key)
  )
}

async function readSnapshot(source: WorkspaceProjectSource): Promise<Snapshot> {
  const repos = source.listRepos()
  const rows = await source.listWorktreeRows()
  const folders = source.listFolderWorkspaces()
  return { repos, rows, folders, projects: projectsOf(source, repos, rows, folders) }
}

/** The project a link made before projects existed pointed into, by its worktree or folder workspace. */
function legacyProjectKey(snapshot: Snapshot, key: string): string | null {
  const scope = parseWorkspaceKey(key)
  if (scope?.type === 'folder') {
    const folder = snapshot.folders.find((entry) => entry.id === scope.folderWorkspaceId)
    return folder ? botTeamGroupProjectKey(folder.projectGroupId) : null
  }
  if (scope?.type === 'worktree') {
    const row = snapshot.rows.find((entry) => entry.id === scope.worktreeId)
    if (!row) {
      return null
    }
    const groupId = projectGroupIdFromRepoId(row.repoId)
    return groupId === null ? botTeamRepoProjectKey(row.repoId) : botTeamGroupProjectKey(groupId)
  }
  return null
}

/** Repos and folder projects on the host, one row each and never one per worktree, by name. */
export async function listBotTeamLinkableWorkspaces(
  source: WorkspaceProjectSource
): Promise<BotTeamLinkableWorkspace[]> {
  return (await readSnapshot(source)).projects.map((project) => project.entry)
}

/**
 * The project a stored link names. A link saved against a worktree or folder workspace is read as
 * its project; one whose worktree is gone is null, so a task start reports it as gone.
 */
export async function findBotTeamWorkspaceProject(
  source: WorkspaceProjectSource,
  workspaceKey: string
): Promise<WorkspaceProject | null> {
  const snapshot = await readSnapshot(source)
  const key = parseBotTeamProjectKey(workspaceKey)
    ? workspaceKey
    : (legacyProjectKey(snapshot, workspaceKey) ?? workspaceKey)
  return snapshot.projects.find((project) => project.entry.key === key) ?? null
}
