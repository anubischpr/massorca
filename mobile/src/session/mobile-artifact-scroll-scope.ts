import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react'
import type { View } from 'react-native'
import { isSpanNearViewport } from './mobile-artifact-viewport'

/** The Artifacts list's viewport and its scroll events, for tiles that load only near the screen. */
export type ArtifactScrollScope = {
  viewport: RefObject<View | null>
  subscribe: (listener: () => void) => () => void
}

export const ArtifactScrollScopeContext = createContext<ArtifactScrollScope | null>(null)

/**
 * Whether a tile has come near the list's viewport. Latches once true, so a page that scrolled
 * away keeps its preview. Without a scope (a tile outside the list) it is near at once.
 */
export function useArtifactTileNearViewport(): {
  ref: RefObject<View | null>
  near: boolean
  onLayout: () => void
} {
  const scope = useContext(ArtifactScrollScopeContext)
  const ref = useRef<View>(null)
  const [near, setNear] = useState(scope === null)

  const check = useCallback(() => {
    if (!scope) {
      return
    }
    ref.current?.measureInWindow((_x, top, _width, height) => {
      scope.viewport.current?.measureInWindow((_viewX, viewTop, _viewWidth, viewHeight) => {
        if (
          isSpanNearViewport(
            { top, bottom: top + height },
            { top: viewTop, bottom: viewTop + viewHeight }
          )
        ) {
          setNear(true)
        }
      })
    })
  }, [scope])

  useEffect(() => {
    if (!scope || near) {
      return
    }
    check()
    return scope.subscribe(check)
  }, [scope, near, check])

  return { ref, near, onLayout: check }
}
