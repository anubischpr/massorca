import type { BotTeamTask } from '../shared/rpc-contract/bot-team-room-params'

export type WaitOutcome =
  | { reason: 'finished'; task: BotTeamTask }
  | { reason: 'awaiting-answer'; task: BotTeamTask }
  | { reason: 'timeout'; task: BotTeamTask | null }

const MIN_INTERVAL_MS = 50
const MAX_INTERVAL_MS = 2000

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSettled(task: BotTeamTask | null): boolean {
  return task !== null && (task.awaitingPerson === true || Boolean(task.lastStatus))
}

/**
 * Polls the room until the task finishes or waits for the person. The interval scales with the
 * timeout, so a short wait does not sleep past its own deadline.
 */
export async function waitForBotTeamTask(options: {
  readRoomTasks: () => Promise<BotTeamTask[]>
  taskId: string
  timeoutMs: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}): Promise<WaitOutcome> {
  const sleep = options.sleep ?? pause
  const now = options.now ?? Date.now
  const intervalMs = Math.min(
    MAX_INTERVAL_MS,
    Math.max(MIN_INTERVAL_MS, Math.floor(options.timeoutMs / 10))
  )
  const deadline = now() + options.timeoutMs
  const readTask = async (): Promise<BotTeamTask | null> =>
    (await options.readRoomTasks()).find((entry) => entry.id === options.taskId) ?? null
  let task = await readTask()
  while (!isSettled(task) && now() < deadline) {
    await sleep(intervalMs)
    task = await readTask()
  }
  if (task !== null && task.awaitingPerson === true) {
    return { reason: 'awaiting-answer', task }
  }
  if (task !== null && task.lastStatus) {
    return { reason: 'finished', task }
  }
  return { reason: 'timeout', task }
}
