import type {
  BotTeamMessage,
  BotTeamProject,
  BotTeamSentRequest,
  BotTeamTask
} from '../../../shared/rpc-contract/bot-team-room-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'
import { RuntimeRpcCallError } from './runtime-rpc-result'

// A host from before code sources or briefs sends projects without them: not connected, empty.
export function withProjectDefaults(project: BotTeamProject): BotTeamProject {
  return {
    ...project,
    codeSource: project.codeSource ?? null,
    brief: project.brief ?? { requirements: [], constraints: [], decisions: [] },
    briefUpdatedAt: project.briefUpdatedAt ?? null
  }
}

/** Archived projects come back only when asked: every other reader must not offer them. */
export async function listBotTeamRoom(
  teamId: string,
  options: { includeArchived?: boolean } = {}
): Promise<{
  tasks: BotTeamTask[]
  messages: BotTeamMessage[]
  projects?: BotTeamProject[]
  /** Tasks other teams filed in the projects this team owns or is linked to. */
  projectTasks?: BotTeamTask[]
  /** Tasks other teams hold for this room's requests; a host from before it never sends this. */
  sentRequests?: BotTeamSentRequest[]
  /** Bots the host is answering in the background; a host from before it never sends this. */
  replying?: { botId: string; since: number }[]
}> {
  const room = await callRuntimeRpc<{
    tasks: BotTeamTask[]
    messages: BotTeamMessage[]
    projects?: BotTeamProject[]
    projectTasks?: BotTeamTask[]
    sentRequests?: BotTeamSentRequest[]
    /** Bots the host is answering in the background; a host from before it never sends this. */
    replying?: { botId: string; since: number }[]
  }>(botTeamHostTarget(currentBotTeamHost()), 'botTeams.listRoom', {
    teamId,
    withLinkedProjects: true
  })
  if (!room.projects) {
    return room
  }
  const shown = options.includeArchived
    ? room.projects
    : room.projects.filter((project) => project.archivedAt == null)
  return { ...room, projects: shown.map(withProjectDefaults) }
}

/** A host from before shared projects lacks these methods: the answer is 'unavailable'. */
async function callProjectMethod<TResult>(
  method: string,
  params: unknown
): Promise<TResult | 'unavailable'> {
  try {
    return await callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** `teamId` is the team acting; linkedTeamIds replaces the teams besides the owner. */
export async function updateBotTeamProject(input: {
  projectId: string
  teamId: string
  name?: string
  goal?: string
  linkedTeamIds?: string[]
}): Promise<BotTeamProject | 'unavailable'> {
  const done = await callProjectMethod<{ project: BotTeamProject }>('botTeams.updateProject', input)
  return done === 'unavailable' ? done : withProjectDefaults(done.project)
}

/** Only the owner team may archive or restore; the host refuses any other. */
export async function archiveBotTeamProject(input: {
  projectId: string
  teamId: string
  archived: boolean
}): Promise<BotTeamProject | 'unavailable'> {
  const done = await callProjectMethod<{ project: BotTeamProject }>(
    'botTeams.archiveProject',
    input
  )
  return done === 'unavailable' ? done : withProjectDefaults(done.project)
}

/** Only the owner team may delete; it removes the project from every team that has it. */
export async function deleteBotTeamProject(input: {
  projectId: string
  teamId: string
}): Promise<'deleted' | 'unavailable'> {
  const done = await callProjectMethod<{ deleted: true }>('botTeams.deleteProject', input)
  return done === 'unavailable' ? done : 'deleted'
}
