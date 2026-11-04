import { botAgentPiRuntime } from '../../../../shared/bot-team-character-art'
import { botTeamClockNote } from '../../../../shared/bot-team-person-clock'
import { BOT_TEAM_ALL_AUTHOR } from '../../../../shared/bot-team-greeting'
import { findNamedProject } from '../../../../shared/bot-team-owner-selection'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamEngramMemory } from '../../../../shared/rpc-contract/bot-team-engram-params'
import type {
  BotTeamMessage,
  BotTeamProject
} from '../../../../shared/rpc-contract/bot-team-room-params'
import {
  botCanReadCode,
  botCanSearch,
  buildBotTeamConversationPrompt,
  chooseConversationBot,
  cleanConversationReply
} from '../../../bot-teams/bot-team-conversation'
import { botConversationChoice } from '../../../bot-teams/bot-team-model-choice'
import { readBotTeamMemoryLines } from '../../../bot-teams/bot-team-memory-read'
import { engramProjectName } from '../../../bot-teams/bot-team-engram-project'
import { readEngramMemories } from '../../../bot-teams/bot-team-engram-reader'
import {
  botTeamProjectContext,
  ENGRAM_CONTEXT_MAX_ENTRIES
} from '../../../bot-teams/bot-team-reply-context'
import { codeReadHostAgents } from '../../../bot-teams/bot-team-code-read-config'
import { askBotAgentForBotTeamReply } from '../../../bot-teams/bot-team-request-query'
import { workspaceProjectSource } from '../../../bot-teams/bot-team-project-workspace'
import { linkedProjectReadPath } from '../../../bot-teams/bot-team-task-worktree'
import { rankDelegationAgents } from '../../../delegated-session/delegation-agent-ranking'
import { delegationUsageCandidates } from '../../../delegated-session/delegation-usage-input'
import { mainI18n } from '../../../i18n/main-i18n'
import { deniedMarketplaceAppIdsForBot } from '../../../marketplace/marketplace-bot-run-denial'
import type { RpcContext } from '../core'
import { engramCli } from './bot-team-engram-methods'
import { botTeamReplyFailureLine } from './bot-team-reply-failure-line'
import { clearBotTeamReplying, markBotTeamReplying } from './bot-team-reply-in-flight'

// Kept in memory: a restart only forgets who spoke last, so the rotation starts again.
const answering = new Set<string>()
const lastToAnswer = new Map<string, string>()

/** Used percent per agent, from the same meter the delegation card reads; an unreadable meter is unknown. */
function usagePercentByAgent(ctx: RpcContext, bots: BotTeam['bots']): Map<string, number> {
  try {
    const agents = [...new Set(bots.map((bot) => bot.agent))].map((agent) => {
      const piRuntime = botAgentPiRuntime(agent)
      return { agent, ...(piRuntime ? { piRuntime } : {}) }
    })
    const { ranking } = rankDelegationAgents({
      candidates: delegationUsageCandidates(ctx.runtime.getAccountsSnapshot().rateLimits, agents),
      now: Date.now(),
      parentAgent: null
    })
    return new Map(
      ranking.filter((entry) => !entry.noData).map((entry) => [entry.agent, entry.bindingPercent])
    )
  } catch {
    return new Map()
  }
}

/** The latest Engram memories of a project, read the way the Memory view reads them; none when not readable. */
async function readEngramLines(project: string): Promise<readonly BotTeamEngramMemory[] | null> {
  const read = await readEngramMemories(engramCli.run, {
    project,
    limit: ENGRAM_CONTEXT_MAX_ENTRIES
  })
  return read.status === 'ok' ? read.memories : null
}

/**
 * The named project, read for the reply. A research question gets its brief only; a room or code
 * answer gets its tasks, the team's and the bot's memory, and its Engram lines (read only, never imported here).
 */
async function projectContextOf(
  ctx: RpcContext,
  args: { team: BotTeam; bot: BotTeamBot; project: BotTeamProject; briefOnly: boolean }
): Promise<string> {
  const { team, bot, project } = args
  if (args.briefOnly) {
    return botTeamProjectContext({
      project,
      tasks: [],
      bots: team.bots,
      memory: { team: [], bot: [] },
      botName: bot.name,
      engram: null,
      briefOnly: true
    })
  }
  const db = ctx.runtime.getOrchestrationDb()
  const tasks = [
    ...db.listBotTeamTasks(team.id),
    ...db.listBotTeamProjectTasksOfOtherTeams(team.id)
  ].filter((task) => task.projectId === project.id)
  const engramName = engramProjectName(team, project, ctx.runtime.listRepos())
  return botTeamProjectContext({
    project,
    tasks,
    bots: team.bots,
    memory: readBotTeamMemoryLines(db, team.id, bot.id),
    botName: bot.name,
    engram: engramName ? await readEngramLines(engramName) : null,
    briefOnly: false
  })
}

/** Whether a repo lives on an SSH host, which a read-only checkout turn here cannot reach. */
function remoteRepoTest(ctx: RpcContext): (repoId: string) => boolean {
  const remote = new Set(
    ctx.runtime
      .listRepos()
      .filter((repo) => repo.connectionId)
      .map((repo) => repo.id)
  )
  return (repoId) => remote.has(repoId)
}

/** Asks the chosen bot's agent once; null when nothing came back. */
async function askConversationBot(
  ctx: RpcContext,
  args: {
    team: BotTeam
    bot: BotTeamBot
    text: string
    research: boolean
    code: boolean
    project: BotTeamProject | null
    timeZone: string | null
  }
): Promise<string | null> {
  const { team, bot, research, project } = args
  // A Gentle Shell bot answers through Gentle Shell itself, never stock Pi or another agent.
  const piRuntime = botAgentPiRuntime(bot.agent)
  const own = {
    id: bot.agent,
    ...botConversationChoice(bot.agent),
    ...(piRuntime ? { piRuntime } : {})
  }
  const db = ctx.runtime.getOrchestrationDb()
  // Only a bot whose agent can search runs a web search; any other says once that it could not.
  const canSearch = research && botCanSearch(bot)
  // A code question reads the linked project's main checkout, only with an agent that can read
  // read-only; anything else answers from the context and says the code was not read.
  const checkout =
    args.code && project?.workspace && botCanReadCode(bot, codeReadHostAgents())
      ? await linkedProjectReadPath(
          workspaceProjectSource(ctx.runtime),
          project.workspace.key,
          remoteRepoTest(ctx)
        )
      : null
  const codeNotRead = args.code && checkout === null
  const deniedMarketplaceApps = await deniedMarketplaceAppIdsForBot({
    botId: bot.id,
    teamId: team.id
  })
  // With no project named nothing is read, so the query goes out at once.
  const projectContext = project
    ? await projectContextOf(ctx, { team, bot, project, briefOnly: research && !args.code })
    : null
  return cleanConversationReply(
    await askBotAgentForBotTeamReply({
      prompt: buildBotTeamConversationPrompt({
        team,
        bot,
        bots: team.bots,
        messages: db.listBotTeamMessages(team.id).slice(0, -1),
        tasks: db.listBotTeamTasks(team.id),
        text: args.text,
        deniedMarketplaceApps,
        research,
        canSearch,
        projectContext,
        ...(checkout !== null && project ? { codeRead: { projectName: project.name } } : {}),
        ...(codeNotRead ? { codeNotRead: true } : {}),
        clock: botTeamClockNote(Date.now(), args.timeZone)
      }),
      agent: own,
      settings: ctx.runtime.getClientSettings(),
      getAgentEnvResolvers: () => ctx.runtime.getCommitMessageAgentEnvironmentResolvers(),
      research: canSearch,
      ...(checkout !== null ? { codeRead: { cwd: checkout } } : {})
    }),
    { research: research || args.code }
  )
}

/**
 * One bot answers a plain conversation, once, under its own name: one short query to its agent, not a
 * session. The bot is chosen at once and `done` settles when the room has its line: the reply, or
 * one line from the team saying nobody could answer. Null when the team has no bot.
 */
export function startBotTeamConversationReply(
  ctx: RpcContext,
  args: {
    team: BotTeam
    text: string
    subjectBotIds: readonly string[]
    research?: boolean
    /** The classifier marked a question about a project's code. */
    code?: boolean
    /** The asking person's zone, so a day the question names is read on their clock. */
    timeZone?: string | null
  }
): { botId: string; done: Promise<BotTeamMessage> } | null {
  const { team, text } = args
  if (team.bots.length === 0) {
    return null
  }
  const db = ctx.runtime.getOrchestrationDb()
  const research = args.research === true
  const code = args.code === true
  const project = findNamedProject(text, db.listBotTeamProjects(team.id, { includeLinked: true }))
  const bot = chooseConversationBot({
    bots: team.bots,
    subjectBotIds: args.subjectBotIds,
    busyBotIds: answering,
    usagePercentByAgent: usagePercentByAgent(ctx, team.bots),
    lastBotId: lastToAnswer.get(team.id) ?? null,
    research,
    code: code && Boolean(project?.workspace),
    codeReadHostAgents: codeReadHostAgents()
  })
  answering.add(bot.id)
  lastToAnswer.set(team.id, bot.id)
  markBotTeamReplying(team.id, bot.id)
  const settle = async (): Promise<BotTeamMessage> => {
    try {
      const reply = await askConversationBot(ctx, {
        team,
        bot,
        text,
        research,
        code,
        project,
        timeZone: args.timeZone ?? null
      })
      if (reply) {
        return db.postBotTeamMessage({ teamId: team.id, authorBotId: bot.id, text: reply })
      }
    } catch {
      // A failed query reads as no answer: the room shows the same line.
    } finally {
      answering.delete(bot.id)
      clearBotTeamReplying(team.id, bot.id)
    }
    // The room always shows an outcome; a choice card cannot follow a reply already sent.
    return db.postBotTeamMessage({
      teamId: team.id,
      authorBotId: BOT_TEAM_ALL_AUTHOR,
      text: botTeamReplyFailureLine(text, mainI18n.language)
    })
  }
  return { botId: bot.id, done: settle() }
}
