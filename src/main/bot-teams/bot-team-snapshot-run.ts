import type { BotTeamSnapshotFailure } from './bot-team-snapshot-types'

export class SnapshotFailure extends Error {
  constructor(
    readonly reason: BotTeamSnapshotFailure,
    message: string
  ) {
    super(message)
  }
}

// A team's versions change one at a time: two saves at once would take the same number.
const lanes = new Map<string, Promise<unknown>>()

export function inLane<T>(storeDir: string, work: () => Promise<T>): Promise<T> {
  const previous = lanes.get(storeDir) ?? Promise.resolve()
  const next = previous.then(work, work)
  const tail = next.catch(() => {})
  lanes.set(storeDir, tail)
  void tail.then(() => {
    if (lanes.get(storeDir) === tail) {
      lanes.delete(storeDir)
    }
  })
  return next
}

export function toFailure(error: unknown): SnapshotFailure {
  if (error instanceof SnapshotFailure) {
    return error
  }
  return new SnapshotFailure('failed', error instanceof Error ? error.message : String(error))
}

export async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    throw toFailure(error)
  }
}
