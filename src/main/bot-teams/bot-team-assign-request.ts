import { chooseBotTeamOwner } from '../../shared/bot-team-owner-selection'
import { botTeamTaskTitle } from '../../shared/bot-team-request-route'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

/** Tasks that have started, per bot: what "least busy" counts. */
export function activeTasksByBot(db: OrchestrationDb, teamId: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const task of db.listBotTeamTasks(teamId)) {
    if (task.sessionId !== null) {
      counts[task.ownerBotId] = (counts[task.ownerBotId] ?? 0) + 1
    }
  }
  return counts
}

/** Files a request the person placed by hand: with the chosen bot, or the receiving team's least busy. */
export function assignBotTeamRequest(
  db: OrchestrationDb,
  input: { teamId: string; toTeamId?: string; botId?: string; text: string }
): BotTeamTask {
  const receivingId = input.toTeamId ?? input.teamId
  const team = db.listBotTeams().find((entry) => entry.id === receivingId)
  if (!team) {
    throw new Error(`Team ${receivingId} was not found.`)
  }
  const owner = input.botId
    ? team.bots.find((bot) => bot.id === input.botId)
    : chooseBotTeamOwner({
        matchedBotIds: team.bots.map((bot) => bot.id),
        bots: team.bots,
        activeTasksByBot: activeTasksByBot(db, team.id)
      })
  if (input.botId && !owner) {
    throw new Error(`Bot ${input.botId} is not on team ${team.id}.`)
  }
  if (!owner) {
    throw new Error(`${team.name} has no bots yet.`)
  }
  return db.createBotTeamTask({
    teamId: team.id,
    title: botTeamTaskTitle(input.text, team.bots),
    prompt: input.text,
    ownerBotId: owner.id
  })
}
