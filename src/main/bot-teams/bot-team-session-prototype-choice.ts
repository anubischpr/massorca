import {
  botTeamPrototypeChoiceIn,
  type BotTeamPrototypeChoice
} from '../../shared/bot-team-prototype-choice'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

/** The count and design system the room's card chose for the task a session runs; null for any other session. */
export function botTeamPrototypeChoiceOfSession(
  db: OrchestrationDb,
  sessionId: string
): BotTeamPrototypeChoice | null {
  const task = db.findBotTeamTaskBySession(sessionId)
  return task ? botTeamPrototypeChoiceIn(db.getBotTeamTaskStartNotes(task.id)) : null
}
