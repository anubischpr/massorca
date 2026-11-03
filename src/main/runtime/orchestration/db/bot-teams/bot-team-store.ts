import { z } from 'zod'
import { AGENT_SESSION_ACCESS_MODES } from '../../../../../shared/agent-session-access-mode'
import {
  BOT_MODEL_MODES,
  BOT_TEAM_CHARACTERS,
  type BotDraftInput,
  type BotTeam,
  type BotTeamCreateInput,
  type BotTeamUpdateInput
} from '../../../../../shared/rpc-contract/bot-team-params'
import { isTuiAgent } from '../../../../../shared/tui-agent-config'
import { resolveBotModelChoice } from '../../../../bot-teams/bot-team-model-choice'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'
import { deleteProjectRows } from './bot-team-project-teams-store'

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
  agent: z.string().refine(isTuiAgent),
  model_mode: z.enum(BOT_MODEL_MODES),
  model: z.string().nullable(),
  effort: z.string().nullable(),
  skills: z.string().transform((value) => z.array(z.string()).parse(JSON.parse(value)))
})

const TEAM_COLUMNS = 'id, name, purpose, character, workspaces_enabled, access_mode'
const BOT_COLUMNS = 'id, team_id, name, job, agent, model_mode, model, effort, skills'

function toBot(row: z.output<typeof BotRow>): BotTeam['bots'][number] {
  const { id, name, job, agent, model_mode: modelMode, model, effort, skills } = row
  const bot = { id, name, job, agent, modelMode, model, effort, skills }
  // A bot saved before the model was picked gets one the first time it is read.
  return modelMode === 'auto' && model === null
    ? { ...bot, ...resolveBotModelChoice({ name, job, agent, skills }) }
    : bot
}

function toBotTeam(row: z.output<typeof TeamRow>, bots: z.output<typeof BotRow>[]): BotTeam {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    character: row.character,
    workspacesEnabled: row.workspaces_enabled === 1,
    accessMode: row.access_mode,
    bots: bots.filter((bot) => bot.team_id === row.id).map(toBot)
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
  const choice = resolveBotModelChoice(bot)
  db.db
    .prepare(`INSERT INTO bot_team_bots (${BOT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      generateId('bot'),
      teamId,
      bot.name,
      bot.job,
      bot.agent,
      choice.modelMode,
      choice.model,
      choice.effort,
      JSON.stringify(choice.skills)
    )
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
    .prepare(
      'UPDATE bot_teams SET name = ?, purpose = ?, character = ?, access_mode = ?, workspaces_enabled = ? WHERE id = ?'
    )
    .run(
      input.name ?? team.name,
      input.purpose ?? team.purpose,
      input.character ?? team.character,
      input.accessMode ?? team.accessMode,
      (input.workspacesEnabled ?? team.workspacesEnabled) ? 1 : 0,
      input.teamId
    )
  return requireBotTeam(this, input.teamId)
}

export function deleteBotTeam(this: OrchestrationDb, teamId: string): void {
  inSavepoint(this, 'delete_bot_team', () => {
    // Why: other teams may have filed tasks in the projects this team owns; they go with the project.
    for (const owned of this.db
      .prepare('SELECT id FROM bot_team_projects WHERE team_id = ?')
      .all(teamId)) {
      deleteProjectRows(this, z.object({ id: z.string() }).parse(owned).id)
    }
    this.db.prepare('DELETE FROM bot_team_project_teams WHERE team_id = ?').run(teamId)
    this.db
      .prepare(
        'DELETE FROM bot_team_task_delegations WHERE task_id IN (SELECT id FROM bot_team_tasks WHERE team_id = ?)'
      )
      .run(teamId)
    this.db.prepare('DELETE FROM bot_team_workspaces WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_team_memory WHERE team_id = ?').run(teamId)
    this.db
      .prepare(
        'DELETE FROM bot_team_routine_runs WHERE routine_id IN (SELECT id FROM bot_team_routines WHERE team_id = ?)'
      )
      .run(teamId)
    this.db.prepare('DELETE FROM bot_team_routines WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_team_webhooks WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_team_messages WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_team_tasks WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_team_projects WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_team_bots WHERE team_id = ?').run(teamId)
    this.db.prepare('DELETE FROM bot_teams WHERE id = ?').run(teamId)
  })
}

export function addBotToTeam(this: OrchestrationDb, teamId: string, bot: BotDraftInput): BotTeam {
  requireBotTeam(this, teamId)
  insertBot(this, teamId, bot)
  return requireBotTeam(this, teamId)
}

export function updateBotOnTeam(
  this: OrchestrationDb,
  teamId: string,
  botId: string,
  bot: BotDraftInput
): BotTeam {
  const existing = requireBotTeam(this, teamId).bots.find((entry) => entry.id === botId)
  if (!existing) {
    throw new Error(`Bot ${botId} is not on team ${teamId}.`)
  }
  const choice = resolveBotModelChoice(bot, existing)
  this.db
    .prepare(
      `UPDATE bot_team_bots SET name = ?, job = ?, agent = ?, model_mode = ?, model = ?, effort = ?, skills = ?
       WHERE id = ? AND team_id = ?`
    )
    .run(
      bot.name,
      bot.job,
      bot.agent,
      choice.modelMode,
      choice.model,
      choice.effort,
      JSON.stringify(choice.skills),
      botId,
      teamId
    )
  return requireBotTeam(this, teamId)
}

export function removeBotFromTeam(this: OrchestrationDb, teamId: string, botId: string): BotTeam {
  const owned = this.db
    .prepare('SELECT id FROM bot_team_tasks WHERE owner_bot_id = ? LIMIT 1')
    .get(botId)
  if (owned !== undefined) {
    throw new Error('This bot still has tasks, so it cannot be removed.')
  }
  // What the team remembered about this bot goes with it; the bot row cannot outlive it otherwise.
  this.db.prepare('DELETE FROM bot_team_memory WHERE bot_id = ? AND team_id = ?').run(botId, teamId)
  this.db.prepare('DELETE FROM bot_team_bots WHERE id = ? AND team_id = ?').run(botId, teamId)
  return requireBotTeam(this, teamId)
}

export type BotTeamStoreMethods = {
  listBotTeams: typeof listBotTeams
  createBotTeam: typeof createBotTeam
  updateBotTeam: typeof updateBotTeam
  deleteBotTeam: typeof deleteBotTeam
  addBotToTeam: typeof addBotToTeam
  updateBotOnTeam: typeof updateBotOnTeam
  removeBotFromTeam: typeof removeBotFromTeam
}

export function attachBotTeamStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    listBotTeams,
    createBotTeam,
    updateBotTeam,
    deleteBotTeam,
    addBotToTeam,
    updateBotOnTeam,
    removeBotFromTeam
  })
}
