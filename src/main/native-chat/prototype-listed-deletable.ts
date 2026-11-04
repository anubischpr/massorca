// Which sets of a listing the host would delete, asked once per chat.

import type { PrototypeListedSet } from '../../shared/rpc-contract/prototype-params'

export function deletableChecker(
  isDeletable: ((sessionId: string) => Promise<boolean>) | undefined
): (sessionId: string) => Promise<boolean> {
  const answers = new Map<string, Promise<boolean>>()
  return (sessionId) => {
    const known = answers.get(sessionId)
    if (known !== undefined) {
      return known
    }
    const answer = (isDeletable?.(sessionId) ?? Promise.resolve(false)).catch(() => false)
    answers.set(sessionId, answer)
    return answer
  }
}

// Every set may carry it: a set whose chat is gone can be deleted without archiving it first.
export async function withDeletable(
  set: PrototypeListedSet,
  deletableOf: (sessionId: string) => Promise<boolean>
): Promise<PrototypeListedSet> {
  return (await deletableOf(set.sessionId))
    ? { ...set, deletable: true }
    : set
}
