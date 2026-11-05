import type { BotTeamMessage, BotTeamTask } from './rpc-contract/bot-team-room-params'

/** The message fields read: who wrote it, from which team, and the host's time. */
export type BotTeamRoomReportMessage = Pick<
  BotTeamMessage,
  'id' | 'authorBotId' | 'createdAt' | 'fromTeamId'
>

/** The task fields read: its team, owner bot, session, and the host's time it was made. */
export type BotTeamRoomReportTask = Pick<
  BotTeamTask,
  'id' | 'teamId' | 'ownerBotId' | 'sessionId' | 'createdAt'
>

/**
 * The tasks whose Prototypes results sit under each message: a task with a session goes under its owner
 * bot's latest post before that bot's next task began, else its owner's latest post since it was made.
 * Messages carry no task id, so only host times are compared; a task or post without one is skipped.
 */
export function botTeamRoomPrototypeTasks<TTask extends BotTeamRoomReportTask>(
  messages: readonly BotTeamRoomReportMessage[],
  tasks: readonly TTask[],
  roomTeamId: string
): ReadonlyMap<string, TTask[]> {
  const byMessageId = new Map<string, TTask[]>()
  for (const task of tasks) {
    const made = task.createdAt
    if (task.sessionId === null || made === null || made === undefined) {
      continue
    }
    // A report from another team's task carries that team; this room's own posts carry none.
    const posts = messages.filter(
      (message) =>
        message.authorBotId === task.ownerBotId &&
        (message.fromTeamId ?? roomTeamId) === task.teamId &&
        typeof message.createdAt === 'number' &&
        message.createdAt >= made
    )
    const next = nextTaskStart(task, tasks)
    const anchor =
      latest(posts.filter((message) => (message.createdAt ?? 0) < next)) ?? latest(posts)
    if (anchor === null) {
      continue
    }
    const listed = byMessageId.get(anchor.id)
    if (listed) {
      listed.push(task)
    } else {
      byMessageId.set(anchor.id, [task])
    }
  }
  return byMessageId
}

/**
 * The sets a task's card row shows: a set made in another room task's own session belongs under that
 * task, so a lead that handed a prototype to a teammate does not repeat the teammate's card.
 */
export function botTeamRoomTaskSets<TSet extends { sessionId: string }>(
  sets: readonly TSet[],
  sessionId: string,
  roomSessionIds: ReadonlySet<string>
): TSet[] {
  return sets.filter((set) => set.sessionId === sessionId || !roomSessionIds.has(set.sessionId))
}

/** The sessions of a room's tasks, which own the sets made in them. */
export function botTeamRoomTaskSessions(
  tasks: readonly Pick<BotTeamRoomReportTask, 'sessionId'>[]
): ReadonlySet<string> {
  return new Set(tasks.flatMap((task) => (task.sessionId === null ? [] : [task.sessionId])))
}

function nextTaskStart(task: BotTeamRoomReportTask, tasks: readonly BotTeamRoomReportTask[]) {
  let next = Number.POSITIVE_INFINITY
  for (const other of tasks) {
    const time = other.createdAt
    if (
      other.id !== task.id &&
      other.ownerBotId === task.ownerBotId &&
      other.teamId === task.teamId &&
      typeof time === 'number' &&
      time > (task.createdAt ?? 0) &&
      time < next
    ) {
      next = time
    }
  }
  return next
}

// A tie goes to the later message, which the host listed after the earlier one.
function latest(posts: readonly BotTeamRoomReportMessage[]): BotTeamRoomReportMessage | null {
  let found: BotTeamRoomReportMessage | null = null
  for (const post of posts) {
    if (found === null || (post.createdAt ?? 0) >= (found.createdAt ?? 0)) {
      found = post
    }
  }
  return found
}
