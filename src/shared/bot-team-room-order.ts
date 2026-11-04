import type { BotTeamMessage, BotTeamTask } from './rpc-contract/bot-team-room-params'

/** The message fields the room order reads: who wrote it, its text, and the host's time. */
export type BotTeamRoomOrderMessage = Pick<
  BotTeamMessage,
  'id' | 'authorBotId' | 'text' | 'createdAt'
>

/** The card fields the room order reads: the request it was made from, and the host's time. */
export type BotTeamRoomOrderTask = Pick<BotTeamTask, 'id' | 'prompt' | 'createdAt' | 'fromRoutine'>

export type BotTeamRoomPlacement<TTask extends BotTeamRoomOrderTask> = {
  /** Cards that sit right after their request, in the order they were made. */
  cardsByMessageId: ReadonlyMap<string, TTask[]>
  /** Cards with no request in the room: they sit after the conversation, as before. */
  trailing: TTask[]
  /** Routine runs from before every message: they sit before the conversation. */
  leading: TTask[]
}

/**
 * Places each card right after the person's message it came from: the first message with its
 * prompt, else the latest one the host wrote at or before the card. Only host times are compared.
 */
export function placeBotTeamRoomTasks<TTask extends BotTeamRoomOrderTask>(
  messages: readonly BotTeamRoomOrderMessage[],
  tasks: readonly TTask[]
): BotTeamRoomPlacement<TTask> {
  const people = messages.filter((message) => message.authorBotId === null)
  const cardsByMessageId = new Map<string, TTask[]>()
  const trailing: TTask[] = []
  const leading: TTask[] = []
  for (const task of tasks) {
    // A routine run answers no request, so it stays at the time it ran, after whoever spoke last.
    const requestId = task.fromRoutine
      ? latestAtOrBefore(task, messages)
      : requestIdOf(task, people)
    if (requestId === null && task.fromRoutine && task.createdAt != null) {
      leading.push(task)
      continue
    }
    if (requestId === null) {
      trailing.push(task)
      continue
    }
    const cards = cardsByMessageId.get(requestId)
    if (cards) {
      cards.push(task)
    } else {
      cardsByMessageId.set(requestId, [task])
    }
  }
  return { cardsByMessageId, trailing, leading }
}

function requestIdOf(
  task: BotTeamRoomOrderTask,
  people: readonly BotTeamRoomOrderMessage[]
): string | null {
  const sameText = people.find((message) => message.text === task.prompt)
  if (sameText !== undefined) {
    return sameText.id
  }
  return latestAtOrBefore(task, people)
}

function latestAtOrBefore(
  task: BotTeamRoomOrderTask,
  messages: readonly BotTeamRoomOrderMessage[]
): string | null {
  const cardTime = task.createdAt
  if (cardTime === null || cardTime === undefined) {
    return null
  }
  let latest: { id: string; time: number } | null = null
  for (const message of messages) {
    const time = message.createdAt
    if (time === null || time === undefined || time > cardTime) {
      continue
    }
    // A tie goes to the later message, which the host listed after the earlier one.
    if (latest === null || time >= latest.time) {
      latest = { id: message.id, time }
    }
  }
  return latest?.id ?? null
}
