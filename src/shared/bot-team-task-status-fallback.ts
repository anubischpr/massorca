import type { AgentSessionStatusSummary } from './agent-session-wire'
import {
  botTeamTaskStatus,
  type BotTeamTaskLastStatus,
  type BotTeamTaskStatus
} from './bot-team-task-status'

/** Every status but Unknown: the ones a card can sit in a column for. */
export type PlacedBotTeamTaskStatus = Exclude<BotTeamTaskStatus, 'Unknown'>

export type BotTeamTaskPlacement = {
  /** The chip: Unknown until the host answers for the session. */
  status: BotTeamTaskStatus
  /** The status that puts the card in its column: live, else stored, else kept, else Todo. */
  placedAs: PlacedBotTeamTaskStatus
}

/**
 * Where a task sits before the host answers: the chip waits, and the column comes from what the host
 * stored last, then the summary kept here, then Todo. Only a live status ever reads Working.
 */
export function botTeamTaskPlacement(input: {
  sessionId: string | null
  live: AgentSessionStatusSummary | undefined
  kept: AgentSessionStatusSummary | undefined
  stored: BotTeamTaskLastStatus | null | undefined
  /** The bot ended its turn on a question for the person; a Done task then waits for them. */
  awaitingPerson?: boolean
}): BotTeamTaskPlacement {
  const awaiting = input.awaitingPerson === true
  const status = botTeamTaskStatus(input.sessionId, input.live, awaiting)
  if (status !== 'Unknown') {
    return { status, placedAs: status }
  }
  const keptStatus = botTeamTaskStatus(input.sessionId, input.kept, awaiting)
  const known: PlacedBotTeamTaskStatus =
    input.stored ?? (keptStatus === 'Unknown' ? 'Not started' : keptStatus)
  return { status, placedAs: awaiting && known === 'Done' ? 'Waiting for you' : known }
}
