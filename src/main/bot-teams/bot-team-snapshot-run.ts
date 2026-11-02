import { isMissingCommandBinaryError } from '../git/exec-error'
import { createBotTeamSnapshotGit, type BotTeamSnapshotGit } from './bot-team-snapshot-git'
import type { BotTeamSnapshotDeps, BotTeamSnapshotFailure } from './bot-team-snapshot-types'

export class SnapshotFailure extends Error {
  constructor(
    readonly reason: BotTeamSnapshotFailure,
    message: string
  ) {
    super(message)
  }
}

// A team's versions change one at a time: two saves at once would race for the same ref.
const lanes = new Map<string, Promise<unknown>>()

export function inLane<T>(gitDir: string, work: () => Promise<T>): Promise<T> {
  const previous = lanes.get(gitDir) ?? Promise.resolve()
  const next = previous.then(work, work)
  const tail = next.catch(() => {})
  lanes.set(gitDir, tail)
  void tail.then(() => {
    if (lanes.get(gitDir) === tail) {
      lanes.delete(gitDir)
    }
  })
  return next
}

export function gitOf(deps: BotTeamSnapshotDeps): BotTeamSnapshotGit {
  return deps.git ?? createBotTeamSnapshotGit(deps.gitDir)
}

export function toFailure(error: unknown): SnapshotFailure {
  if (error instanceof SnapshotFailure) {
    return error
  }
  if (isMissingCommandBinaryError(error)) {
    return new SnapshotFailure('git-unavailable', 'Git is not installed on this host.')
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
