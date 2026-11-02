import { chooseBotTeamOwner, findNamedProject } from '../../shared/bot-team-owner-selection'
import type { BotTeamRequestChoice } from '../../shared/bot-team-request-choice'
import { botTeamRequestTiming } from '../../shared/bot-team-request-later'
import { botTeamTaskTitle } from '../../shared/bot-team-request-route'
import type { BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { botTeamCompositeNotes } from './bot-team-composite'
import { botTeamFiledReply } from './bot-team-filed-reply'

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

/** What filing a request needs: where it goes, who takes it, and the person's answers so far. */
export type BotTeamRequestFiling = {
  teamId: string
  text: string
  /** The team the request goes to when it is another team; this team otherwise. */
  toTeamId?: string
  /** The bot that takes it; the least busy bot of the receiving team when absent. */
  botId?: string
  /** The other bots a composite task has parts for. */
  alsoNeeds?: string[]
  start: boolean
  later: boolean
  /** Only a client that can show the project question asks; an older one never sees it. */
  askProject: boolean
  /** The answer to the project question: a project of this team, or null for none. Absent until asked. */
  projectId?: string | null
}

export type BotTeamFiling = {
  task: BotTeamTask | null
  startError: string | null
  /** The project question: nothing is filed until the person answers it. */
  choice?: BotTeamRequestChoice
}

/** Starts a filed task when asked; one that cannot start waits in Todo with the reason. */
export async function startFiled(
  task: BotTeamTask,
  start: boolean,
  startTask: (taskId: string) => Promise<BotTeamTask>
): Promise<{ task: BotTeamTask; startError: string | null }> {
  if (!start) {
    return { task, startError: null }
  }
  try {
    return { task: await startTask(task.id), startError: null }
  } catch (error) {
    return { task, startError: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Files a request as one task for the bot that takes it, with its project and the notes of a
 * composite task, then has that bot say in the room what became of it.
 */
export async function fileBotTeamRequest(
  db: OrchestrationDb,
  input: BotTeamRequestFiling,
  startTask: (taskId: string) => Promise<BotTeamTask>
): Promise<BotTeamFiling> {
  const receivingId = input.toTeamId ?? input.teamId
  const receiving = db.listBotTeams().find((entry) => entry.id === receivingId)
  if (!receiving) {
    throw new Error(`Team ${receivingId} was not found.`)
  }
  const owner = input.botId
    ? receiving.bots.find((bot) => bot.id === input.botId)
    : chooseBotTeamOwner({
        matchedBotIds: receiving.bots.map((bot) => bot.id),
        bots: receiving.bots,
        activeTasksByBot: activeTasksByBot(db, receiving.id)
      })
  if (input.botId && !owner) {
    throw new Error(`Bot ${input.botId} is not on team ${receiving.id}.`)
  }
  if (!owner) {
    throw new Error(`${receiving.name} has no bots yet.`)
  }
  const alsoNeeds = input.alsoNeeds ?? []
  const projects = db.listBotTeamProjects(receiving.id, { includeLinked: true })
  const named = findNamedProject(input.text, projects)
  // Asked only of this team: a request sent to another team takes that team's own reading.
  if (
    input.askProject &&
    input.toTeamId === undefined &&
    input.projectId === undefined &&
    projects.length > 0 &&
    named === null
  ) {
    return {
      task: null,
      startError: null,
      choice: { kind: 'project', botId: owner.id, ...(alsoNeeds.length > 0 ? { alsoNeeds } : {}) }
    }
  }
  const projectId = input.projectId !== undefined ? input.projectId : (named?.id ?? null)
  if (projectId !== null && !projects.some((project) => project.id === projectId)) {
    throw new Error(`Project ${projectId} is not on team ${receiving.id}.`)
  }
  const created = db.createBotTeamTask({
    teamId: receiving.id,
    title: botTeamTaskTitle(input.text, receiving.bots),
    prompt: input.text,
    ownerBotId: owner.id
  })
  if (projectId !== null) {
    db.setBotTeamTaskProject(created.id, projectId)
  }
  // Saved with the task, so the owner reads it whether the task starts now or from Todo later.
  db.setBotTeamTaskStartNotes(created.id, botTeamCompositeNotes(receiving.bots, alsoNeeds))
  // Read again: the project was set after the task was created.
  const task = db.getBotTeamTask(created.id)
  const timing = botTeamRequestTiming(input.text)
  const later = input.later || timing.later
  const started = input.start && !later
  const filed = started
    ? await startFiled(task, true, startTask)
    : { task, startError: null as string | null }
  db.postBotTeamMessage({
    teamId: receiving.id,
    authorBotId: owner.id,
    text: botTeamFiledReply({
      started,
      later,
      when: timing.when,
      projectName: projects.find((project) => project.id === projectId)?.name ?? null,
      startError: filed.startError
    })
  })
  return { task: filed.task, startError: filed.startError }
}
