import { isBotTeamFolderPath } from '../../../../shared/bot-team-folder'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import {
  folderWorkspaceToWorktree,
  projectGroupIdFromRepoId
} from '../../../../shared/folder-workspace-worktree'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import {
  BotTeamProjectSetWorkspace,
  BotTeamRoomSelector,
  type BotTeamLinkableWorkspace
} from '../../../../shared/rpc-contract/bot-team-room-params'
import type { Worktree } from '../../../../shared/worktree/types'
import { isWorkspaceKey, worktreeWorkspaceKey } from '../../../../shared/workspace-scope'
import type { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { defineMethod, type RpcContext } from '../core'

/** Why: a capped page would hide workspaces from the picker, so every row is read. */
const EVERY_ROW_LIMIT = Number.MAX_SAFE_INTEGER

type WorktreeRowFields = Pick<
  Worktree,
  'id' | 'repoId' | 'path' | 'displayName' | 'manualDisplayName'
>

/** What the listing reads from the host; the same calls worktree.list and folderWorkspace.list make. */
export type LinkableWorkspaceSource = {
  listRepos: () => readonly Pick<Repo, 'id' | 'kind'>[]
  listWorktreeRows: () => Promise<readonly WorktreeRowFields[]>
  listFolderWorkspaces: () => readonly FolderWorkspace[]
}

export function linkableWorkspaceSource(runtime: RpcContext['runtime']): LinkableWorkspaceSource {
  return {
    listRepos: () => runtime.listRepos(),
    listWorktreeRows: async () =>
      (await runtime.listManagedWorktrees(undefined, EVERY_ROW_LIMIT)).worktrees,
    listFolderWorkspaces: () => runtime.listFolderWorkspaces()
  }
}

/** The name a workspace shows under: the person's own name when it has one. */
function displayNameOf(row: Pick<Worktree, 'displayName' | 'manualDisplayName'>): string {
  return row.manualDisplayName?.trim() || row.displayName
}

/** Git worktrees and folder workspaces on the host, minus the teams' own folders, by name. */
export async function listBotTeamLinkableWorkspaces(
  source: LinkableWorkspaceSource
): Promise<BotTeamLinkableWorkspace[]> {
  const folderRepoIds = new Set(
    source
      .listRepos()
      .filter(isFolderRepo)
      .map((repo) => repo.id)
  )
  const found = new Map<string, BotTeamLinkableWorkspace>()
  const add = (entry: BotTeamLinkableWorkspace): void => {
    if (!found.has(entry.key)) {
      found.set(entry.key, entry)
    }
  }
  for (const row of await source.listWorktreeRows()) {
    if (isBotTeamFolderPath(row.path)) {
      continue
    }
    const isFolder = folderRepoIds.has(row.repoId) || projectGroupIdFromRepoId(row.repoId) !== null
    add({
      // Why: a folder workspace's row id is already its workspace key; a git row needs the prefix.
      key: isWorkspaceKey(row.id) ? row.id : worktreeWorkspaceKey(row.id),
      name: displayNameOf(row),
      kind: isFolder ? 'folder' : 'git'
    })
  }
  for (const folder of source.listFolderWorkspaces()) {
    if (isBotTeamFolderPath(folder.folderPath)) {
      continue
    }
    const row = folderWorkspaceToWorktree(folder)
    add({ key: row.id, name: displayNameOf(row), kind: 'folder' })
  }
  return [...found.values()].sort(
    (left, right) => left.name.localeCompare(right.name) || left.key.localeCompare(right.key)
  )
}

/** Whether a stored workspace key still names a workspace on the host; a gone one stops a start. */
export async function linkableWorkspaceExists(
  source: LinkableWorkspaceSource,
  workspaceKey: string
): Promise<boolean> {
  return (await listBotTeamLinkableWorkspaces(source)).some((entry) => entry.key === workspaceKey)
}

function teamNamed(db: OrchestrationDb, teamId: string): BotTeam {
  const team = db.listBotTeams().find((entry) => entry.id === teamId)
  if (!team) {
    throw new Error(`Team ${teamId} was not found.`)
  }
  return team
}

/** Why: a team with Workspaces off never shows the choice, so the host refuses it too. */
function requireWorkspacesOn(team: BotTeam): void {
  if (!team.workspacesEnabled) {
    throw new Error(`Turn on Workspaces for ${team.name} to link a Workspaces project.`)
  }
}

export const botTeamListLinkableWorkspacesMethod = defineMethod({
  name: 'botTeams.listLinkableWorkspaces',
  permission: 'workspace',
  params: BotTeamRoomSelector,
  handler: async ({ teamId }, { runtime }) => {
    requireWorkspacesOn(teamNamed(runtime.getOrchestrationDb(), teamId))
    return { workspaces: await listBotTeamLinkableWorkspaces(linkableWorkspaceSource(runtime)) }
  }
})

export const botTeamSetProjectWorkspaceMethod = defineMethod({
  name: 'botTeams.setProjectWorkspace',
  permission: 'workspace',
  params: BotTeamProjectSetWorkspace,
  handler: async ({ projectId, workspaceKey }, { runtime }) => {
    const db = runtime.getOrchestrationDb()
    // Why: clearing a link is always allowed, so a team that turned Workspaces off can still unlink.
    if (workspaceKey === null) {
      return { project: db.setBotTeamProjectWorkspace(projectId, null) }
    }
    requireWorkspacesOn(teamNamed(db, db.getBotTeamProject(projectId).teamId))
    const chosen = (await listBotTeamLinkableWorkspaces(linkableWorkspaceSource(runtime))).find(
      (entry) => entry.key === workspaceKey
    )
    if (!chosen) {
      throw new Error('That workspace is not on this host. Pick another one.')
    }
    return {
      project: db.setBotTeamProjectWorkspace(projectId, { key: chosen.key, name: chosen.name })
    }
  }
})

export const BOT_TEAM_PROJECT_WORKSPACE_METHODS = [
  botTeamListLinkableWorkspacesMethod,
  botTeamSetProjectWorkspaceMethod
]
