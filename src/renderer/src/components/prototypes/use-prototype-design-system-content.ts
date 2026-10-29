import { useEffect, useState } from 'react'
import { parseComponentsHtml } from '../../../../shared/prototype-design-system-components'
import { parseDesignTokens } from '../../../../shared/prototype-design-system-tokens'
import { readDesignSystemOnHost } from '../../runtime/runtime-prototype-client'
import { prototypeTargetForSession } from './prototype-host-targets'
import type { DesignSystemContent } from './prototype-design-system-props'

export type DesignSystemContentState =
  | { status: 'loading' }
  | { status: 'ready'; content: DesignSystemContent }
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
            result.ok ? { status: 'ready', content: contentOf(result) } : { status: 'error' }
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

function contentOf(files: { tokensJson?: string; componentsHtml?: string }): DesignSystemContent {
  const tokens = files.tokensJson === undefined ? null : parseDesignTokens(files.tokensJson)
  const components =
    files.componentsHtml === undefined ? null : parseComponentsHtml(files.componentsHtml)
  return {
    tokens: tokens?.tokens ?? [],
    meta: tokens?.meta ?? { history: [], sources: [], palettes: [] },
    components: components?.sections ?? [],
    styleBlock: components?.styleBlock ?? ''
  }
}
