import { engramProjectName } from '../../../bot-teams/bot-team-engram-project'
import {
  readEngramMemories,
  runEngramCli,
  type EngramRunner
} from '../../../bot-teams/bot-team-engram-reader'
import {
  BotTeamEngramList,
  ENGRAM_DEFAULT_LIMIT,
  type BotTeamEngramReply
} from '../../../../shared/rpc-contract/bot-team-engram-params'
import { defineMethod } from '../core'

/** Tests swap the runner so the real CLI is never started. */
export const engramCli: { run: EngramRunner } = { run: runEngramCli }

export const botTeamListEngramMemoryMethod = defineMethod({
  name: 'botTeams.listEngramMemory',
  permission: 'workspace',
  params: BotTeamEngramList,
  handler: async (
    { teamId, projectId, query, limit },
    { runtime }
  ): Promise<BotTeamEngramReply> => {
    const db = runtime.getOrchestrationDb()
    const team = db.listBotTeams().find((entry) => entry.id === teamId)
    const project = db.getBotTeamProject(projectId)
    const name = team ? engramProjectName(team, project, runtime.listRepos()) : null
    if (!name) {
      return { status: 'not-linked', memories: [] }
    }
    const read = await readEngramMemories(engramCli.run, {
      project: name,
      query,
      limit: limit ?? ENGRAM_DEFAULT_LIMIT
    })
    return read.status === 'ok'
      ? { status: 'ok', projectName: name, memories: read.memories }
      : { status: read.status, projectName: name, memories: [] }
  }
})

/** Read-only: this host's own engram CLI, never another host's. */
export const BOT_TEAM_ENGRAM_METHODS = [botTeamListEngramMemoryMethod]
