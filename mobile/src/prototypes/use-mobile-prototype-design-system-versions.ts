import { useCallback, useEffect, useState } from 'react'
import type { DesignSystemVersionListed } from '../../../src/shared/rpc-contract/prototype-params'
import { listMobilePrototypeDesignSystemVersions } from './mobile-prototype-design-system-version-rpc'
import type { RpcClient } from '../transport/rpc-client'

export type MobileDesignSystemVersionsState =
  | { status: 'loading' }
  | { status: 'ready'; versions: DesignSystemVersionListed[] }
  /** An older host lacks the versions method, so the screen offers no Versions sheet. */
  | { status: 'unsupported' }
  | { status: 'error' }

/** The saved versions of a design system, read through one of its project's chats; `reload` lists them again. */
export function useMobilePrototypeDesignSystemVersions(
  client: RpcClient | null,
  sessionId: string | undefined
): MobileDesignSystemVersionsState & { reload: () => void } {
  const [generation, setGeneration] = useState(0)
  const [state, setState] = useState<MobileDesignSystemVersionsState>({ status: 'loading' })
  useEffect(() => {
    if (client === null || sessionId === undefined) {
      return
    }
    let active = true
    void listMobilePrototypeDesignSystemVersions(client, { sessionId }).then((result) => {
      if (!active) {
        return
      }
      setState(
        result.kind === 'ready'
          ? { status: 'ready', versions: result.versions }
          : result.kind === 'unsupported-host'
            ? { status: 'unsupported' }
            : { status: 'error' }
      )
    })
    return () => {
      active = false
    }
  }, [client, sessionId, generation])
  const reload = useCallback(() => setGeneration((value) => value + 1), [])
  return sessionId === undefined ? { status: 'error', reload } : { ...state, reload }
}
