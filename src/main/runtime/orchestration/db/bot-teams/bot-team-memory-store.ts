import { z } from 'zod'
import {
  BotTeamMemoryEntrySchema,
  type BotTeamMemoryEntry,
  type BotTeamMemoryInput
} from '../../../../../shared/rpc-contract/bot-team-memory-params'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'

const MEMORY_MAX_CHARS = 500

const MemoryRow = z.object({
  id: z.string(),
  team_id: z.string(),
  bot_id: z.string().nullable(),
  text: z.string(),
  source_kind: z.enum(['task', 'person']),
  source_title: z.string().nullable()
})

function toEntry(row: z.output<typeof MemoryRow>): BotTeamMemoryEntry {
  return BotTeamMemoryEntrySchema.parse({
    id: row.id,
    teamId: row.team_id,
    botId: row.bot_id,
    text: row.text,
    source: { kind: row.source_kind, taskTitle: row.source_title }
  })
}

export function addBotTeamMemory(
  this: OrchestrationDb,
  input: BotTeamMemoryInput
): BotTeamMemoryEntry {
  const text = input.text.trim().slice(0, MEMORY_MAX_CHARS)
  if (text === '') {
    throw new Error('Nothing to remember.')
  }
  if (
    input.botId !== null &&
    this.db
      .prepare('SELECT id FROM bot_team_bots WHERE id = ? AND team_id = ?')
      .get(input.botId, input.teamId) === undefined
  ) {
    throw new Error(`Bot ${input.botId} is not on team ${input.teamId}.`)
  }
  const id = generateId('botmem')
  this.db
    .prepare(
      'INSERT INTO bot_team_memory (id, team_id, bot_id, text, source_kind, source_title) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, input.teamId, input.botId, text, input.source.kind, input.source.taskTitle)
  return toEntry(
    MemoryRow.parse(this.db.prepare('SELECT * FROM bot_team_memory WHERE id = ?').get(id))
  )
}

export function listBotTeamMemory(this: OrchestrationDb, teamId: string): BotTeamMemoryEntry[] {
  return z
    .array(MemoryRow)
    .parse(
      this.db.prepare('SELECT * FROM bot_team_memory WHERE team_id = ? ORDER BY rowid').all(teamId)
    )
    .map(toEntry)
}

/** True when the line existed. The person deleted it: no bot reads it again. */
export function deleteBotTeamMemory(this: OrchestrationDb, memoryId: string): boolean {
  return this.db.prepare('DELETE FROM bot_team_memory WHERE id = ?').run(memoryId).changes > 0
}

export type BotTeamMemoryStoreMethods = {
  addBotTeamMemory: typeof addBotTeamMemory
  listBotTeamMemory: typeof listBotTeamMemory
  deleteBotTeamMemory: typeof deleteBotTeamMemory
}

export const BOT_TEAM_MEMORY_STORE_METHODS = {
  addBotTeamMemory,
  listBotTeamMemory,
  deleteBotTeamMemory
}
