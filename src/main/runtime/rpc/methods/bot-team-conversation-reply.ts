import { botAgentPiRuntime } from '../../../../shared/bot-team-character-art'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
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

/**
 * One bot answers a plain conversation, once, under its own name: one short query to its agent, not a
 * session. Null when nothing could answer, so the room asks the person instead.
 */
export async function replyToBotTeamConversation(
  ctx: RpcContext,
  args: { team: BotTeam; text: string; subjectBotIds: readonly string[] }
): Promise<BotTeamMessage | null> {
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
  try {
    // Gentle Shell has no one-shot call of its own, and must never run as stock Pi.
    const own = botAgentPiRuntime(bot.agent)
      ? null
      : { id: bot.agent, ...botConversationChoice(bot.agent) }
    const reply = cleanConversationReply(
      await askBotAgentForBotTeamReply({
        prompt: buildBotTeamConversationPrompt({
          team,
          bot,
          bots: team.bots,
          messages: db.listBotTeamMessages(team.id).slice(0, -1),
          tasks: db.listBotTeamTasks(team.id),
          text
        }),
        agent: own,
        settings: ctx.runtime.getClientSettings(),
        getAgentEnvResolvers: () => ctx.runtime.getCommitMessageAgentEnvironmentResolvers()
      })
    )
    return reply
      ? db.postBotTeamMessage({ teamId: team.id, authorBotId: bot.id, text: reply })
      : null
  } finally {
    answering.delete(bot.id)
  }
}
