import { useEffect, useState } from 'react'
import {
  designSystemContentOf,
  type DesignSystemContent
} from '../../../src/shared/prototype-design-system-content'
import {
  readMobilePrototypeDesignSystem,
  readMobilePrototypeDesignSystemVersion,
  type MobilePrototypeDesignSystem
} from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'

export type MobileDesignSystemContentState =
  | { status: 'loading' }
  | { status: 'ready'; content: DesignSystemContent }
  | { status: 'error' }

/**
 * The files of a design system, read from the host through one of its project's chats. A new `reloadKey`
 * (the system's version, count and status) reads them again. A `version` reads that earlier version instead.
 */
export function useMobilePrototypeDesignSystemContent(
  client: RpcClient | null,
  sessionId: string | undefined,
  reloadKey: string,
  version: number | null = null
): MobileDesignSystemContentState {
  const [state, setState] = useState<MobileDesignSystemContentState>({ status: 'loading' })
  useEffect(() => {
    if (client === null || sessionId === undefined) {
      return
    }
    let active = true
    const read: Promise<MobilePrototypeDesignSystem> =
      version === null
        ? readMobilePrototypeDesignSystem(client, { sessionId })
        : readMobilePrototypeDesignSystemVersion(client, { sessionId, version })
    void read.then((result) => {
      if (active) {
        // A failed read keeps the files already shown: losing contact is not an empty system.
        setState((previous) =>
          result.kind === 'ready'
            ? { status: 'ready', content: designSystemContentOf(result) }
            : previous.status === 'ready'
              ? previous
              : { status: 'error' }
        )
      }
    })
    return () => {
      active = false
    }
  }, [client, sessionId, reloadKey, version])
  return sessionId === undefined ? { status: 'error' } : state
}
