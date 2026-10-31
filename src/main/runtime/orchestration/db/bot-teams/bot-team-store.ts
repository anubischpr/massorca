import { z } from 'zod'
import { AGENT_SESSION_ACCESS_MODES } from '../../../../../shared/agent-session-access-mode'
import {
  BOT_TEAM_CHARACTERS,
  type BotDraftInput,
  type BotTeam,
  type BotTeamCreateInput,
  type BotTeamUpdateInput
} from '../../../../../shared/rpc-contract/bot-team-params'
import { isTuiAgent } from '../../../../../shared/tui-agent-config'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'

const TeamRow = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  character: z.enum(BOT_TEAM_CHARACTERS),
  workspaces_enabled: z.number(),
  access_mode: z.enum(AGENT_SESSION_ACCESS_MODES)
})

const BotRow = z.object({
  id: z.string(),
  team_id: z.string(),
  name: z.string(),
  job: z.string(),
  agent: z.string().refine(isTuiAgent)
})

const TEAM_COLUMNS = 'id, name, purpose, character, workspaces_enabled, access_mode'
const BOT_COLUMNS = 'id, team_id, name, job, agent'

function toBotTeam(row: z.output<typeof TeamRow>, bots: z.output<typeof BotRow>[]): BotTeam {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    character: row.character,
    workspacesEnabled: row.workspaces_enabled === 1,
    accessMode: row.access_mode,
    bots: bots
      .filter((bot) => bot.team_id === row.id)
      .map(({ id, name, job, agent }) => ({ id, name, job, agent }))
  }
}

export function listBotTeams(this: OrchestrationDb): BotTeam[] {
  const teams = z
    .array(TeamRow)
    .parse(this.db.prepare(`SELECT ${TEAM_COLUMNS} FROM bot_teams ORDER BY rowid`).all())
  const bots = z
    .array(BotRow)
    .parse(this.db.prepare(`SELECT ${BOT_COLUMNS} FROM bot_team_bots ORDER BY rowid`).all())
  return teams.map((team) => toBotTeam(team, bots))
}

function requireBotTeam(db: OrchestrationDb, teamId: string): BotTeam {
  const row = db.db.prepare(`SELECT ${TEAM_COLUMNS} FROM bot_teams WHERE id = ?`).get(teamId)
  if (row === undefined) {
    throw new Error(`Bot team ${teamId} was not found.`)
  }
  const bots = z
    .array(BotRow)
    .parse(
      db.db
        .prepare(`SELECT ${BOT_COLUMNS} FROM bot_team_bots WHERE team_id = ? ORDER BY rowid`)
        .all(teamId)
    )
  return toBotTeam(TeamRow.parse(row), bots)
}

function insertBot(db: OrchestrationDb, teamId: string, bot: BotDraftInput): void {
  db.db
    .prepare(`INSERT INTO bot_team_bots (${BOT_COLUMNS}) VALUES (?, ?, ?, ?, ?)`)
    .run(generateId('bot'), teamId, bot.name, bot.job, bot.agent)
}

function inSavepoint(db: OrchestrationDb, name: string, work: () => void): void {
  db.db.exec(`SAVEPOINT ${name}`)
  try {
    work()
    db.db.exec(`RELEASE ${name}`)
  } catch (error) {
    db.db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`)
    throw error
  }
}

export function createBotTeam(this: OrchestrationDb, input: BotTeamCreateInput): BotTeam {
  const id = generateId('team')
  inSavepoint(this, 'create_bot_team', () => {
    this.db
      .prepare(`INSERT INTO bot_teams (${TEAM_COLUMNS}) VALUES (?, ?, ?, ?, ?, 'full-access')`)
      .run(id, input.name, input.purpose, input.character, input.workspacesEnabled ? 1 : 0)
    for (const bot of input.bots) {
      insertBot(this, id, bot)
    }
  })
  return requireBotTeam(this, id)
}

export function updateBotTeam(this: OrchestrationDb, input: BotTeamUpdateInput): BotTeam {
  const team = requireBotTeam(this, input.teamId)
  this.db
    .prepare('UPDATE bot_teams SET access_mode = ?, workspaces_enabled = ? WHERE id = ?')
    .run(
      input.accessMode ?? team.accessMode,
      (input.workspacesEnabled ?? team.workspacesEnabled) ? 1 : 0,
      input.teamId
    )
  return requireBotTeam(this, input.teamId)
}

export function deleteBotTeam(this: OrchestrationDb, teamId: string): void {
  inSavepoint(this, 'delete_bot_team', () => {
    this.db.prepare('DELETE FROM bot_team_bots WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_teams WHERE id = ?').run(teamId)
  })
}

export function addBotToTeam(this: OrchestrationDb, teamId: string, bot: BotDraftInput): BotTeam {
  requireBotTeam(this, teamId)
  insertBot(this, teamId, bot)
  return requireBotTeam(this, teamId)
}

export function removeBotFromTeam(this: OrchestrationDb, teamId: string, botId: string): BotTeam {
  this.db.prepare('DELETE FROM bot_team_bots WHERE id = ? AND team_id = ?').run(botId, teamId)
  return requireBotTeam(this, teamId)
}

export type BotTeamStoreMethods = {
  listBotTeams: typeof listBotTeams
  createBotTeam: typeof createBotTeam
  updateBotTeam: typeof updateBotTeam
  deleteBotTeam: typeof deleteBotTeam
  addBotToTeam: typeof addBotToTeam
  removeBotFromTeam: typeof removeBotFromTeam
}

export function attachBotTeamStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    listBotTeams,
    createBotTeam,
    updateBotTeam,
    deleteBotTeam,
    addBotToTeam,
    removeBotFromTeam
  })
}
