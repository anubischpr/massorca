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
 * Whether a tile is near the list's viewport, kept current as the list scrolls: a tile scrolled far
 * away reports false, so its live preview can be released. Without a scope (a tile outside the list)
 * it is near at once.
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
        setNear(
          isSpanNearViewport(
            { top, bottom: top + height },
            { top: viewTop, bottom: viewTop + viewHeight }
          )
        )
      })
    })
  }, [scope])

  useEffect(() => {
    if (!scope) {
      return
    }
    check()
    return scope.subscribe(check)
  }, [scope, check])

  return { ref, near, onLayout: check }
}
