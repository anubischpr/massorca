import { useEffect, useState } from 'react'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { listMobilePrototypeSets } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'

/**
 * The prototype sets of one chat, read again each time its user turns change: a request makes its
 * folder before the message goes out, so the set is listed by the time the turn is in the transcript.
 */
export function useMobilePrototypeChatSets(args: {
  client: RpcClient | null
  sessionId: string | null
  userTurnCount: number
}): readonly PrototypeListedSet[] {
  const { client, sessionId, userTurnCount } = args
  const [sets, setSets] = useState<readonly PrototypeListedSet[]>([])
  useEffect(() => {
    if (client === null || sessionId === null) {
      return
    }
    let active = true
    void listMobilePrototypeSets(client, {}).then((listed) => {
      if (active && listed.kind === 'ready') {
        setSets(listed.sets.filter((set) => set.sessionId === sessionId))
      }
    })
    return () => {
      active = false
    }
  }, [client, sessionId, userTurnCount])
  return sets
}
