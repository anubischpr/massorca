import {
  botTeamStatusAwaiting,
  botTeamTaskStatus,
  type BotTeamTaskStatus
} from '../shared/bot-team-task-status'
import type { BotTeamTask } from '../shared/rpc-contract/bot-team-room-params'

// Why: the CLI has no live session summaries, so a task shows the final status the host kept.
export function taskStatus(task: BotTeamTask): BotTeamTaskStatus {
  if (task.lastStatus) {
    return botTeamStatusAwaiting(task.lastStatus, task.awaitingPerson)
  }
  return task.awaitingPerson === true
    ? 'Waiting for you'
    : botTeamTaskStatus(task.sessionId, undefined)
}

/** What a request filing reply says, with the fields the room sends back; each is optional for older hosts. */
export type FilingReply = {
  task?: { id: string; title: string } | null
  startError?: string | null
  choice?: { kind: string } | null
  later?: boolean
  greeted?: boolean
  answered?: boolean
  replying?: unknown
  scheduled?: { date: string; time: string }
}

export type FilingAsk = { teamId: string; messageId: string; start: boolean; later: boolean }

/** The lines that say what became of a request, so the person knows the next step. */
export function describeFiling(reply: FilingReply, asked: FilingAsk): string[] {
  if (reply.greeted === true) {
    return ['Greeted the room.']
  }
  if (reply.answered === true) {
    return ['A bot answered in the room; nothing was filed.']
  }
  if (reply.replying !== undefined && reply.replying !== null) {
    return ['A bot is answering in the room.']
  }
  if (reply.choice) {
    return [
      `The room asks before filing: ${reply.choice.kind}.`,
      `Answer with: orca bot-teams answer --team ${asked.teamId} --request ${asked.messageId} (--bot, --team-to, --project or --later)`
    ]
  }
  if (reply.scheduled) {
    return [`Scheduled for ${reply.scheduled.date} ${reply.scheduled.time}.`]
  }
  if (reply.task) {
    const { id, title } = reply.task
    if (reply.startError) {
      return [
        `Filed task ${id} (${title}); it did not start: ${reply.startError}. It waits in Todo.`
      ]
    }
    if (!asked.start || asked.later || reply.later === true) {
      return [`Filed task ${id} (${title}); it waits in Todo.`]
    }
    return [`Filed task ${id} (${title}) and started it.`]
  }
  return reply.later === true ? ['Saved for later.'] : []
}
