import type { BotTeamRoomAttachment } from '../../../shared/bot-team-room-attachments'
import type { BotTeamRequestChoice } from '../../../shared/bot-team-request-choice'
import { withSenderTimeZone } from '../../../shared/bot-team-routine-zone'
import type {
  BotDraftInput,
  BotTeam,
  BotTeamCreateInput,
  BotTeamUpdateInput
} from '../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamBrief,
  BotTeamCodeSource,
  BotTeamLinkableWorkspace,
  BotTeamProject,
  BotTeamTask
} from '../../../shared/rpc-contract/bot-team-room-params'
import type {
  BotTeamFileVersion,
  BotTeamVersionFile,
  BotTeamVersionRestoreResult,
  BotTeamVersionsResult
} from '../../../shared/rpc-contract/bot-team-version-params'
import type {
  RuntimeFileListEntry,
  RuntimeFileListResult,
  RuntimeFileReadResult
} from '../../../shared/runtime-file-contracts'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { withProjectDefaults } from './runtime-bot-team-project-client'
import { callRuntimeRpc } from './runtime-rpc-client'
import { postWithFileNamesIfTextRequired } from './runtime-bot-team-files-only-retry'
import { RuntimeRpcCallError } from './runtime-rpc-result'
import { toRuntimeWorktreeSelector } from './runtime-worktree-selector'

// Teams live on one host; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

export async function createBotTeamProject(input: {
  teamId: string
  name: string
  goal: string
  codeSource: BotTeamCodeSource | null
  /** Teams besides the owner; an older host drops it and makes an owner-only project. */
  linkedTeamIds?: string[]
}): Promise<BotTeamProject> {
  return withProjectDefaults(
    (await call<{ project: BotTeamProject }>('botTeams.createProject', input)).project
  )
}

/** A host from before code sources lacks the method: the answer is 'unavailable', not a failure. */
export async function setBotTeamProjectCodeSource(
  projectId: string,
  codeSource: BotTeamCodeSource
): Promise<BotTeamProject | 'unavailable'> {
  try {
    return withProjectDefaults(
      (
        await call<{ project: BotTeamProject }>('botTeams.setProjectCodeSource', {
          projectId,
          codeSource
        })
      ).project
    )
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** The Workspaces projects the team's host offers; 'unavailable' on a host from before they existed. */
export async function listBotTeamLinkableWorkspaces(
  teamId: string
): Promise<BotTeamLinkableWorkspace[] | 'unavailable'> {
  try {
    return (
      await call<{ workspaces: BotTeamLinkableWorkspace[] }>('botTeams.listLinkableWorkspaces', {
        teamId
      })
    ).workspaces
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** Links a project to a Workspaces project, or unlinks it with null; 'unavailable' on an older host. */
export async function setBotTeamProjectWorkspace(
  projectId: string,
  workspaceKey: string | null
): Promise<BotTeamProject | 'unavailable'> {
  try {
    return withProjectDefaults(
      (
        await call<{ project: BotTeamProject }>('botTeams.setProjectWorkspace', {
          projectId,
          workspaceKey
        })
      ).project
    )
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

export async function setBotTeamTaskProject(
  taskId: string,
  projectId: string | null
): Promise<BotTeamTask> {
  return (await call<{ task: BotTeamTask }>('botTeams.setTaskProject', { taskId, projectId })).task
}

export async function postBotTeamRequest(input: {
  teamId: string
  text: string
  start: boolean
  /** Only this client can answer the project question, so it asks; an older client never does. */
  askProject?: boolean
  /** One id per send, reused on a retry of that send; a host from before it posts again. */
  clientRequestId?: string
  /** Files from the team folder; sent only to a host that takes them in its room. */
  attachments?: BotTeamRoomAttachment[]
}): Promise<{
  task: BotTeamTask | null
  startError: string | null
  greeted?: boolean
  /** A host from before the query's classes never sends the next two. */
  choice?: BotTeamRequestChoice
  composite?: string[]
  /** A bot answered a plain conversation in the room; nothing was filed. */
  answered?: boolean
  /** A bot is answering in the background; the room shows it typing until its line lands. */
  replying?: { botId: string }
  /** The request went to another team, because the person named it with @. */
  sentTo?: { teamId: string; teamName: string }
  /** The person asked for the work later: it waits in Todo and nothing starts. */
  later?: boolean
}> {
  const sent = withSenderTimeZone(input)
  return postWithFileNamesIfTextRequired(sent, (next) => call('botTeams.postMessage', next))
}

/** What the person answered on a choice card, or the project question, for one held request. */
export type BotTeamRequestFiling = {
  teamId: string
  text: string
  botId?: string
  toTeamId?: string
  alsoNeeds?: string[]
  start: boolean
  later?: boolean
  askProject?: boolean
  /** A project of the team, or null for none; absent until the project question is asked. */
  projectId?: string | null
  /** Files the person attached to the request before the choice was asked. */
  attachments?: BotTeamRoomAttachment[]
}

/** Files a request the room held: the host may ask the project question again before filing. */
export function fileBotTeamRequest(input: BotTeamRequestFiling): Promise<{
  task: BotTeamTask | null
  startError: string | null
  choice?: BotTeamRequestChoice
}> {
  return call('botTeams.assignRequest', withSenderTimeZone(input))
}

export async function startBotTeamTask(taskId: string): Promise<BotTeamTask> {
  return (await call<{ task: BotTeamTask }>('botTeams.startTask', { taskId })).task
}

export async function listBotTeams(): Promise<BotTeam[]> {
  return (await call<{ teams: BotTeam[] }>('botTeams.list')).teams
}

export async function createBotTeam(input: BotTeamCreateInput): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.create', input)).team
}

export async function updateBotTeam(input: BotTeamUpdateInput): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.update', input)).team
}

export async function deleteBotTeam(teamId: string): Promise<void> {
  await call('botTeams.delete', { teamId })
}

export async function addBotToTeam(teamId: string, bot: BotDraftInput): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.addBot', { teamId, bot })).team
}

export async function updateBotOnTeam(
  teamId: string,
  botId: string,
  bot: BotDraftInput
): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.updateBot', { teamId, botId, bot })).team
}

export async function removeBotFromTeam(teamId: string, botId: string): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.removeBot', { teamId, botId })).team
}

/** Keeps what the person wrote in a project's Brief; 'unavailable' on a host from before briefs. */
export async function setBotTeamProjectBrief(
  projectId: string,
  input: { goal: string; brief: BotTeamBrief }
): Promise<BotTeamProject | 'unavailable'> {
  try {
    return withProjectDefaults(
      (await call<{ project: BotTeamProject }>('botTeams.setProjectBrief', { projectId, ...input }))
        .project
    )
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** The selector of the team's folder on its host, or null before any task made it. */
async function teamFolderSelector(teamId: string): Promise<string | null> {
  const { workspaceId } = await call<{ workspaceId: string | null }>('botTeams.workspace', {
    teamId
  })
  return workspaceId === null ? null : toRuntimeWorktreeSelector(workspaceId)
}

/** The team folder's workspace id on its host; null before any task made it, or when the host cannot say. */
/** The team folder's workspace and path on its host, made now when the team has none: the first attach needs it. */
export function ensureBotTeamFolderWorkspace(
  teamId: string
): Promise<{ workspaceId: string; folderPath: string }> {
  return call('botTeams.workspace', { teamId, ensure: true })
}

export async function botTeamFolderWorkspaceId(teamId: string): Promise<string | null> {
  try {
    return (await call<{ workspaceId: string | null }>('botTeams.workspace', { teamId }))
      .workspaceId
  } catch {
    return null
  }
}

/** A host from before team files lacks a method: the answer is 'unavailable', not a failure. */
async function orUnavailable<TResult>(
  read: () => Promise<TResult>
): Promise<TResult | 'unavailable'> {
  try {
    return await read()
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** The files of the team's folder, through the host's own file listing. */
export function listBotTeamFiles(
  teamId: string
): Promise<{ files: RuntimeFileListEntry[]; truncated: boolean } | 'unavailable'> {
  return orUnavailable(async () => {
    const worktree = await teamFolderSelector(teamId)
    if (worktree === null) {
      return { files: [], truncated: false }
    }
    const listed = await call<RuntimeFileListResult>('files.list', { worktree })
    return { files: listed.files, truncated: listed.truncated }
  })
}

export function readBotTeamFile(
  teamId: string,
  relativePath: string
): Promise<RuntimeFileReadResult | 'unavailable'> {
  return orUnavailable(async () => {
    const worktree = await teamFolderSelector(teamId)
    if (worktree === null) {
      throw new Error('This team has no folder yet.')
    }
    return call<RuntimeFileReadResult>('files.read', { worktree, relativePath })
  })
}

/** The team's saved versions, or 'unavailable' on a host from before versions. */
export function listBotTeamVersions(
  teamId: string
): Promise<BotTeamVersionsResult | 'unavailable'> {
  return orUnavailable(() => call<BotTeamVersionsResult>('botTeams.versions', { teamId }))
}

export function listBotTeamFileVersions(
  teamId: string,
  relativePath: string
): Promise<BotTeamFileVersion[] | 'unavailable'> {
  return orUnavailable(
    async () =>
      (
        await call<{ versions: BotTeamFileVersion[] }>('botTeams.fileVersions', {
          teamId,
          relativePath
        })
      ).versions
  )
}

export function readBotTeamVersionFile(
  teamId: string,
  versionId: string,
  relativePath: string
): Promise<BotTeamVersionFile | 'unavailable'> {
  return orUnavailable(
    async () =>
      (
        await call<{ file: BotTeamVersionFile }>('botTeams.versionFile', {
          teamId,
          versionId,
          relativePath
        })
      ).file
  )
}

/** Puts one file back as a version held it; the host saves the current state first. */
export function restoreBotTeamFileVersion(
  teamId: string,
  versionId: string,
  relativePath: string
): Promise<BotTeamVersionRestoreResult | 'unavailable'> {
  return orUnavailable(
    async () =>
      (
        await call<{ result: BotTeamVersionRestoreResult }>('botTeams.restoreFileVersion', {
          teamId,
          versionId,
          relativePath
        })
      ).result
  )
}

export { listBotTeamRoom } from './runtime-bot-team-project-client'
