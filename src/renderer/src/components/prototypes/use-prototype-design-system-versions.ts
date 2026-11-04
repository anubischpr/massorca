import { useEffect, useState } from 'react'
import {
  designSystemContentOf,
  type DesignSystemContent
} from '../../../../shared/prototype-design-system-content'
import type { DesignSystemVersionListed } from '../../../../shared/rpc-contract/prototype-params'
import {
  listDesignSystemVersionsOnHost,
  readDesignSystemVersionOnHost
} from '../../runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'

/** `unavailable` covers a host without the versions method, an unknown chat and any failed read: no Versions button. */
export type DesignSystemVersionsState =
  | { status: 'loading' }
  | { status: 'ready'; versions: readonly DesignSystemVersionListed[] }
  | { status: 'unavailable' }

/**
 * Every saved and listed version of a design system, newest first. A new `reloadKey` (the system's version and
 * status) lists them again.
 */
export function useDesignSystemVersions(
  sessionId: string | undefined,
  reloadKey: string
): DesignSystemVersionsState {
  const [state, setState] = useState<DesignSystemVersionsState>({ status: 'loading' })
  useEffect(() => {
    if (sessionId === undefined) {
      setState({ status: 'unavailable' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    listDesignSystemVersionsOnHost(prototypeTargetForSession(sessionId), { sessionId })
      .then((result) => {
        if (active) {
          setState(
            result.ok ? { status: 'ready', versions: result.versions } : { status: 'unavailable' }
          )
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'unavailable' })
        }
      })
    return () => {
      active = false
    }
  }, [sessionId, reloadKey])
  return state
}

export type DesignSystemVersionContentState =
  | { status: 'loading' }
  | { status: 'ready'; content: DesignSystemContent }
  | { status: 'error' }

/** The files of one saved version, read when `version` is set; null reads nothing. */
export function useDesignSystemVersionContent(
  sessionId: string | undefined,
  version: number | null
): DesignSystemVersionContentState | null {
  const [state, setState] = useState<DesignSystemVersionContentState | null>(null)
  useEffect(() => {
    if (version === null || sessionId === undefined) {
      setState(null)
      return
    }
    let active = true
    setState({ status: 'loading' })
    readDesignSystemVersionOnHost(prototypeTargetForSession(sessionId), { sessionId, version })
      .then((result) => {
        if (active) {
          setState(
            result.ok
              ? { status: 'ready', content: designSystemContentOf(result) }
              : { status: 'error' }
          )
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error' })
        }
      })
    return () => {
      active = false
    }
  }, [sessionId, version])
  return state
}
