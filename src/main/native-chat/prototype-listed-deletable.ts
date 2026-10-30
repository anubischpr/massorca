// Which archived sets of a listing the host would delete, asked once per chat.

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

// Only archived sets carry it: they are the ones a client offers Delete on, so the others cost no check.
export async function withDeletable(
  set: PrototypeListedSet,
  deletableOf: (sessionId: string) => Promise<boolean>
): Promise<PrototypeListedSet> {
  return set.archived === true && (await deletableOf(set.sessionId))
    ? { ...set, deletable: true }
    : set
}
