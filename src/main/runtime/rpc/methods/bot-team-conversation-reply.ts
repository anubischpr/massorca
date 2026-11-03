import { botAgentPiRuntime } from '../../../../shared/bot-team-character-art'
import { BOT_TEAM_ALL_AUTHOR } from '../../../../shared/bot-team-greeting'
import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamMessage } from '../../../../shared/rpc-contract/bot-team-room-params'
import {
  buildBotTeamConversationPrompt,
  chooseConversationBot,
  cleanConversationReply
} from '../../../bot-teams/bot-team-conversation'
import { botConversationChoice } from '../../../bot-teams/bot-team-model-choice'
import { askBotAgentForBotTeamReply } from '../../../bot-teams/bot-team-request-query'
import { rankDelegationAgents } from '../../../delegated-session/delegation-agent-ranking'
import { delegationUsageCandidates } from '../../../delegated-session/delegation-usage-input'
import type { RpcContext } from '../core'
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

/** Asks the chosen bot's agent once; null when nothing came back. */
async function askConversationBot(
  ctx: RpcContext,
  args: { team: BotTeam; bot: BotTeamBot; text: string; research: boolean }
): Promise<string | null> {
  const { team, bot, research } = args
  // A Gentle Shell bot answers through Gentle Shell itself, never stock Pi or another agent.
  const piRuntime = botAgentPiRuntime(bot.agent)
  const own = {
    id: bot.agent,
    ...botConversationChoice(bot.agent),
    ...(piRuntime ? { piRuntime } : {})
  }
  const db = ctx.runtime.getOrchestrationDb()
  return cleanConversationReply(
    await askBotAgentForBotTeamReply({
      prompt: buildBotTeamConversationPrompt({
        team,
        bot,
        bots: team.bots,
        messages: db.listBotTeamMessages(team.id).slice(0, -1),
        tasks: db.listBotTeamTasks(team.id),
        text: args.text,
        research
      }),
      agent: own,
      settings: ctx.runtime.getClientSettings(),
      getAgentEnvResolvers: () => ctx.runtime.getCommitMessageAgentEnvironmentResolvers(),
      research
    }),
    { research }
  )
}

/**
 * One bot answers a plain conversation, once, under its own name: one short query to its agent, not a
 * session. The bot is chosen at once and `done` settles when the room has its line: the reply, or
 * one line from the team saying nobody could answer. Null when the team has no bot.
 */
export function startBotTeamConversationReply(
  ctx: RpcContext,
  args: { team: BotTeam; text: string; subjectBotIds: readonly string[]; research?: boolean }
): { botId: string; done: Promise<BotTeamMessage> } | null {
  const { team, text } = args
  if (team.bots.length === 0) {
    return null
  }
  const db = ctx.runtime.getOrchestrationDb()
  const bot = chooseConversationBot({
    bots: team.bots,
    subjectBotIds: args.subjectBotIds,
    busyBotIds: answering,
    usagePercentByAgent: usagePercentByAgent(ctx, team.bots),
    lastBotId: lastToAnswer.get(team.id) ?? null
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
        research: args.research === true
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
      text: botTeamReplyFailureLine(text)
    })
  }
  return { botId: bot.id, done: settle() }
}
