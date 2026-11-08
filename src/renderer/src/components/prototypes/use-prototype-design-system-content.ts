import { useEffect, useState } from 'react'
import {
  designSystemContentOf,
  type DesignSystemContent
} from '../../../../shared/prototype-design-system-content'
import {
  checkDesignSystemReadability,
  type PrototypeDesignSystemReadability
} from '../../../../shared/prototype-design-system-readability'
import { readDesignSystemOnHost } from '../../runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'

export type DesignSystemContentState =
  | { status: 'loading' }
  | { status: 'ready'; content: DesignSystemContent; check: PrototypeDesignSystemReadability }
  | { status: 'error' }

/**
 * The files of a design system, read from the host through one of its project's chats. A new `reloadKey`
 * (the system's version, count and status) reads them again.
 */
export function useDesignSystemContent(
  sessionId: string | undefined,
  reloadKey: string
): DesignSystemContentState {
  const [state, setState] = useState<DesignSystemContentState>({ status: 'loading' })
  useEffect(() => {
    if (sessionId === undefined) {
      setState({ status: 'error' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    void readDesignSystemOnHost(prototypeTargetForSession(sessionId), { sessionId })
      .then((result) => {
        if (active) {
          setState(
            result.ok
              ? {
                  status: 'ready',
                  content: designSystemContentOf(result),
                  check: checkDesignSystemReadability(result)
                }
              : { status: 'error' }
          )
        }
      })
      .catch((error: unknown) => {
        console.warn(
          `[prototypes] design system read failed for chat ${sessionId}: ${String(error)}`
        )
        if (active) {
          setState({ status: 'error' })
        }
      })
    return () => {
      active = false
    }
  }, [sessionId, reloadKey])
  return state
}
