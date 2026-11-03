import type { BotTeamMemoryEntry } from '../../shared/rpc-contract/bot-team-memory-params'
import type { BotTeamMemoryLines } from './bot-team-task-start'

// The newest lines win: a bot reads a short list when a task starts, not the whole history.
const LINES_PER_SCOPE = 40

/** What the team, and this bot alone, remember: the lines a bot reads when its task starts. */
export function readBotTeamMemoryLines(
  db: { listBotTeamMemory: (teamId: string) => BotTeamMemoryEntry[] },
  teamId: string,
  botId: string
): BotTeamMemoryLines {
  const entries = db.listBotTeamMemory(teamId)
  const texts = (scope: (botOfLine: string | null) => boolean): string[] =>
    entries
      .filter((entry) => scope(entry.botId))
      .map((entry) => entry.text)
      .slice(-LINES_PER_SCOPE)
  return { team: texts((owner) => owner === null), bot: texts((owner) => owner === botId) }
}
