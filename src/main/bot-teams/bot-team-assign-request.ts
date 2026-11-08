import { chooseBotTeamOwner, findNamedProject } from '../../shared/bot-team-owner-selection'
import type { BotTeamRequestChoice } from '../../shared/bot-team-request-choice'
import { botTeamClockNote } from '../../shared/bot-team-person-clock'
import { botTeamRequestTiming } from '../../shared/bot-team-request-later'
import {
  botTeamRoomAttachmentsNote,
  type BotTeamRoomAttachment
} from '../../shared/bot-team-room-attachments'
import { botTeamFilesOnlyText } from '../../shared/bot-team-room-attachments-line'
import { botTeamTaskTitle } from '../../shared/bot-team-request-route'
import type { BotTeamMessage, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { botTeamCompositeNotes } from './bot-team-composite'
import { botTeamReplyNote, type BotTeamReplyQuote } from './bot-team-prompt-notes'
import { botTeamFiledReply } from './bot-team-filed-reply'
import { returnUnstartedBotTeamTask } from './bot-team-return'

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

/** The person's last few lines in the room: what the language of a line with no words is read from. */
export function earlierPersonText(messages: readonly BotTeamMessage[]): string {
  return messages
    .filter((message) => message.authorBotId === null)
    .slice(-5)
    .map((message) => message.text)
    .join(' ')
}

/**
 * The text a request is filed with. A message of only files gets the line that names them, in the
 * language the person wrote before; a request with words keeps them as typed.
 */
export function botTeamRequestText(
  db: OrchestrationDb,
  teamId: string,
  typed: string,
  attachments: readonly BotTeamRoomAttachment[]
): string {
  return typed.trim() === '' && attachments.length > 0
    ? botTeamFilesOnlyText(attachments, earlierPersonText(db.listBotTeamMessages(teamId)))
    : typed
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
  /** Files from the team folder the person attached to the request. */
  attachments?: BotTeamRoomAttachment[]
  /** The room message that asked, kept with a task sent to another team so its card sits under it. */
  originMessageId?: string
  /** The sender's zone: the task's start notes keep the clock the request was asked on. */
  timeZone?: string | null
  /** The room message the request answers; the task's start notes quote it, and a reply never asks the project question. */
  quote?: BotTeamReplyQuote
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
 * The person's latest line with this request's text: where a choice card's answer, which names no
 * message, sends its card, so it stays under the request instead of the end of the room.
 */
function askingMessageId(db: OrchestrationDb, teamId: string, typed: string): string | null {
  const wanted = typed.trim()
  const asked = db
    .listBotTeamMessages(teamId)
    .findLast((message) => message.authorBotId === null && message.text.trim() === wanted)
  return asked?.id ?? null
}

/** The task's start notes: the person's clock, the message a reply quotes, a composite's parts, the files. */
function taskStartNotes(
  bots: Parameters<typeof botTeamCompositeNotes>[0],
  alsoNeeds: readonly string[],
  attachments: readonly BotTeamRoomAttachment[],
  clock: string | null,
  quote: BotTeamReplyQuote | undefined
): string | null {
  const notes = [
    clock,
    quote ? botTeamReplyNote(quote) : null,
    botTeamCompositeNotes(bots, alsoNeeds),
    botTeamRoomAttachmentsNote(attachments)
  ]
  const present = notes.filter((note): note is string => note !== null)
  return present.length > 0 ? present.join('\n\n') : null
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
  // The answer to the project question sends back the empty text it held when the files came alone.
  const text = botTeamRequestText(db, input.teamId, input.text, input.attachments ?? [])
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
  const named = findNamedProject(text, projects)
  // A reply inherits the project of the task that posted the line it answers, if that project is still here.
  const quotedProjectId =
    projects.find((project) => project.id === input.quote?.sourceTask?.projectId)?.id ?? null
  // Asked only of this team, and never of a reply: a request sent to another team takes that team's own reading.
  if (
    input.askProject &&
    input.quote === undefined &&
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
  const projectId = input.projectId !== undefined ? input.projectId : (named?.id ?? quotedProjectId)
  if (projectId !== null && !projects.some((project) => project.id === projectId)) {
    throw new Error(`Project ${projectId} is not on team ${receiving.id}.`)
  }
  const created = db.createBotTeamTask({
    teamId: receiving.id,
    title: botTeamTaskTitle(text, receiving.bots),
    prompt: text,
    ownerBotId: owner.id
  })
  if (projectId !== null) {
    db.setBotTeamTaskProject(created.id, projectId)
  }
  // A task that answers a room message is shown as the bot typing there, not as a card.
  const answered = input.quote?.messageId
  if (answered !== undefined) {
    db.setBotTeamTaskAnswers(created.id, answered)
  }
  // The asking team's room tracks a task another team holds for it.
  if (receiving.id !== input.teamId) {
    db.setBotTeamTaskOrigin(
      created.id,
      input.teamId,
      input.originMessageId ?? askingMessageId(db, input.teamId, input.text)
    )
  }
  // Saved with the task, so the owner reads it whether the task starts now or from Todo later.
  // The clock is the one the request was asked on, so "mañana" stays the day it meant.
  db.setBotTeamTaskStartNotes(
    created.id,
    taskStartNotes(
      receiving.bots,
      alsoNeeds,
      input.attachments ?? [],
      botTeamClockNote(Date.now(), input.timeZone),
      input.quote
    )
  )
  // Read again: the project was set after the task was created.
  const task = db.getBotTeamTask(created.id)
  const timing = botTeamRequestTiming(text)
  const later = input.later || timing.later
  const started = input.start && !later
  const filed = started
    ? await startFiled(task, true, startTask)
    : { task, startError: null as string | null }
  const filedReply = botTeamFiledReply({
    started,
    later,
    when: timing.when,
    projectName: projects.find((project) => project.id === projectId)?.name ?? null,
    startError: filed.startError,
    text
  })
  if (filedReply !== null) {
    db.postBotTeamMessage({ teamId: receiving.id, authorBotId: owner.id, text: filedReply })
  }
  // A task another team asked for that cannot start must not leave the asking room waiting.
  if (filed.startError !== null && receiving.id !== input.teamId) {
    returnUnstartedBotTeamTask(db, created.id, filed.startError)
  }
  return { task: filed.task, startError: filed.startError }
}
