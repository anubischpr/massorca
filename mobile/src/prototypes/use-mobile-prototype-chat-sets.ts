import { useEffect, useState } from 'react'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { listMobilePrototypeSets } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'

/**
 * The prototype sets of one chat and of its finished children, read again each time its user turns or
 * finished children change: a request makes its folder before the message goes out, so the set is
 * listed by the time the turn is in the transcript.
 */
export function useMobilePrototypeChatSets(args: {
  client: RpcClient | null
  sessionId: string | null
  userTurnCount: number
  /** Delegated children that finished here: their sets link from their finish notices. */
  childSessionIds?: readonly string[]
}): readonly PrototypeListedSet[] {
  const { client, sessionId, userTurnCount } = args
  // Why a string: a fresh array each render would refetch on every message.
  const childKey = (args.childSessionIds ?? []).join(' ')
  const [sets, setSets] = useState<readonly PrototypeListedSet[]>([])
  useEffect(() => {
    if (client === null || sessionId === null) {
      return
    }
    let active = true
    void listMobilePrototypeSets(client, {}).then((listed) => {
      if (active && listed.kind === 'ready') {
        const chats = new Set([sessionId, ...childKey.split(' ').filter(Boolean)])
        setSets(listed.sets.filter((set) => chats.has(set.sessionId)))
      }
    })
    return () => {
      active = false
    }
  }, [client, sessionId, userTurnCount, childKey])
  return sets
}
