import { useEffect, useState } from 'react'
import {
  prototypeSessionScopeKey,
  prototypeSetsOfSession,
  type PrototypeSessionScope
} from '../../../src/shared/prototype-session-sets'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { listMobilePrototypeSets } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'

/**
 * The sets a session made itself or through its delegated children, newest first, read again when the
 * scope or `refreshKey` changes; a bot's Conference room post renders one `MobilePrototypeRequestLink` per set.
 */
export function useMobilePrototypeSetsOfSession(args: {
  client: RpcClient | null
  scope: PrototypeSessionScope | null
  /** Bump it (for example with the room's message count) to list again after new work lands. */
  refreshKey?: number
}): readonly PrototypeListedSet[] {
  const { client, refreshKey = 0 } = args
  // Why a key: callers pass a fresh scope object each render.
  const key = prototypeSessionScopeKey(args.scope)
  const [sets, setSets] = useState<readonly PrototypeListedSet[]>([])
  useEffect(() => {
    const [sessionId, ...childSessionIds] = key.split(' ').filter(Boolean)
    if (client === null || sessionId === undefined) {
      setSets([])
      return
    }
    let active = true
    void listMobilePrototypeSets(client, {}).then((listed) => {
      if (active && listed.kind === 'ready') {
        setSets(prototypeSetsOfSession(listed.sets, { sessionId, childSessionIds }))
      }
    })
    return () => {
      active = false
    }
  }, [client, key, refreshKey])
  return sets
}
