import type { BotTeamRequestChoice } from '../../shared/bot-team-request-choice'
import type { BotTeamScheduledMoment } from '../../shared/bot-team-request-schedule'
import { botTeamTaskTitle } from '../../shared/bot-team-request-route'
import {
  botTeamRoomTextWithAttachments,
  type BotTeamRoomAttachment
} from '../../shared/bot-team-room-attachments'
import { isKnownTimeZone } from '../../shared/bot-team-routine-zone'
import type { BotTeam } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamRoutineInput } from '../../shared/rpc-contract/bot-team-routine-params'
import { createBotTeamRoutine } from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { botTeamScheduledReply } from './bot-team-filed-reply'
import { findSimilarBotTeamRoutine } from './bot-team-similar-routine'

export type ScheduledBotTeamRequest =
  | { kind: 'created'; routineId: string }
  | { kind: 'similar'; choice: Extract<BotTeamRequestChoice, { kind: 'similar-routine' }> }

/**
 * Makes the one-time routine a request that names a day and time asks for, and the bot says when it runs.
 * A request like a routine the same bot still has to run is not made: the room asks the person first.
 */
export function scheduleBotTeamRequest(
  db: OrchestrationDb,
  args: {
    team: BotTeam
    botId: string
    text: string
    files: readonly BotTeamRoomAttachment[]
    moment: BotTeamScheduledMoment
    timeZone: string | null
  }
): ScheduledBotTeamRequest {
  const { date, time } = args.moment
  const request: Omit<BotTeamRoutineInput, 'teamId'> = {
    botId: args.botId,
    name: botTeamTaskTitle(args.text, args.team.bots),
    prompt: botTeamRoomTextWithAttachments(args.text, args.files),
    schedule: {
      frequency: 'once',
      time,
      weekday: null,
      monthDay: null,
      date,
      timeZone: args.timeZone && isKnownTimeZone(args.timeZone) ? args.timeZone : null
    }
  }
  const similar = findSimilarBotTeamRoutine(db, {
    teamId: args.team.id,
    botId: args.botId,
    title: request.name
  })
  if (similar !== null && similar.nextRun !== null) {
    return {
      kind: 'similar',
      choice: {
        kind: 'similar-routine',
        routineId: similar.id,
        routineName: similar.name,
        routineNextRun: similar.nextRun,
        request
      }
    }
  }
  const routine = createBotTeamRoutine(db, { teamId: args.team.id, ...request }, Date.now())
  db.postBotTeamMessage({
    teamId: args.team.id,
    authorBotId: args.botId,
    text: botTeamScheduledReply({ date, time, text: args.text })
  })
  return { kind: 'created', routineId: routine.id }
}
