import { useEffect, useState } from 'react'
import { listMobilePrototypeSets } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'
import { mobilePrototypeMenuCount } from './mobile-prototype-list-model'

/** How many prototype sets this chat has, read each time its ⋯ menu opens; 0 until the host answers. */
export function useMobilePrototypeMenuCount(args: {
  client: RpcClient | null
  sessionId: string | null
  visible: boolean
}): number {
  const { client, sessionId, visible } = args
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!visible || client === null || sessionId === null) {
      return
    }
    let active = true
    void listMobilePrototypeSets(client, {}).then((listed) => {
      if (active && listed.kind === 'ready') {
        setCount(mobilePrototypeMenuCount(listed.sets, sessionId))
      }
    })
    return () => {
      active = false
    }
  }, [client, sessionId, visible])
  return count
}
