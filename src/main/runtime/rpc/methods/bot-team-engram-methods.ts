import { engramProjectName } from '../../../bot-teams/bot-team-engram-project'
import {
  readEngramMemories,
  runEngramCli,
  type EngramRunner
} from '../../../bot-teams/bot-team-engram-reader'
import {
  createEngramCloudSync,
  type EngramCloudSync
} from '../../../bot-teams/bot-team-engram-sync'
import {
  BotTeamEngramList,
  ENGRAM_DEFAULT_LIMIT,
  type BotTeamEngramReply
} from '../../../../shared/rpc-contract/bot-team-engram-params'
import { defineMethod } from '../core'

/** Tests swap the runner and the sync so the real CLI is never started. */
export const engramCli: { run: EngramRunner; sync: EngramCloudSync } = {
  run: runEngramCli,
  sync: createEngramCloudSync()
}

export const botTeamListEngramMemoryMethod = defineMethod({
  name: 'botTeams.listEngramMemory',
  permission: 'workspace',
  params: BotTeamEngramList,
  handler: async (
    { teamId, projectId, query, limit, refresh },
    { runtime }
  ): Promise<BotTeamEngramReply> => {
    const db = runtime.getOrchestrationDb()
    const team = db.listBotTeams().find((entry) => entry.id === teamId)
    const project = db.getBotTeamProject(projectId)
    const name = team ? engramProjectName(team, project, runtime.listRepos()) : null
    if (!name) {
      return { status: 'not-linked', memories: [] }
    }
    // Starts or joins the throttled import without waiting: a slow server never blocks the view.
    void engramCli.sync.refresh(engramCli.run, name, { force: refresh === true })
    const { importing, failed, problem } = engramCli.sync.status(name)
    const read = await readEngramMemories(engramCli.run, {
      project: name,
      query,
      limit: limit ?? ENGRAM_DEFAULT_LIMIT
    })
    // A missing CLI is 'unavailable' on its own; refresh notes would add nothing there.
    // An older client reads only refreshFailed, so a host with no cloud setup does not set it.
    const refreshProblem = failed ? (problem ?? 'unreachable') : null
    const refreshNotes =
      read.status === 'unavailable'
        ? {}
        : {
            ...(refreshProblem ? { refreshProblem } : {}),
            ...(refreshProblem === 'unreachable' ? { refreshFailed: true } : {}),
            ...(importing ? { refreshing: true } : {})
          }
    return read.status === 'ok'
      ? { status: 'ok', projectName: name, memories: read.memories, ...refreshNotes }
      : { status: read.status, projectName: name, memories: [], ...refreshNotes }
  }
})

/** Read-only: this host's own engram CLI, never another host's. */
export const BOT_TEAM_ENGRAM_METHODS = [botTeamListEngramMemoryMethod]
