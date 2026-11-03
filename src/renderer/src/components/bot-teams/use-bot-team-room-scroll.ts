// The Conference room's scroll: opens at the latest message, follows new content
// while the reader is at the end, and returns a team's room to the offset the reader
// left it at. The decisions come from the Workspaces chat's pure auto-scroll helpers;
// the room is a plain overflow list, so the pin and the restore live here.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEventHandler
} from 'react'
import {
  distanceFromBottom,
  isNearBottom,
  NATIVE_CHAT_FOLLOW_REARM_PX,
  shouldShowJumpToLatest,
  type ScrollGeometry
} from '../native-chat/native-chat-autoscroll'

/** Offsets of rooms the reader left scrolled up, by team. The page remounts the room, so this outlives it. */
const detachedOffsets = new Map<string, number>()

function geometryOf(element: HTMLElement): ScrollGeometry {
  return {
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight
  }
}

export type BotTeamRoomScroll = {
  /** Ref callbacks: the scroll container and the content inside it. */
  attachScroll: (element: HTMLDivElement | null) => void
  attachContent: (element: HTMLDivElement | null) => void
  showJump: boolean
  onScroll: UIEventHandler<HTMLDivElement>
  jumpToEnd: () => void
}

export function useBotTeamRoomScroll({
  teamId,
  hasContent
}: {
  teamId: string
  /** Whether the room has anything to show; a remembered offset waits for it. */
  hasContent: boolean
}): BotTeamRoomScroll {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const [contentElement, setContentElement] = useState<HTMLDivElement | null>(null)
  const [showJump, setShowJump] = useState(false)
  const attachedRef = useRef<{ element: HTMLDivElement; teamId: string } | null>(null)
  const followingRef = useRef(true)
  const restoreRef = useRef<number | null>(null)
  const previousDistanceRef = useRef(Number.POSITIVE_INFINITY)
  const settleRef = useRef<() => void>(() => {})

  const settle = useCallback(() => {
    const element = scrollElement
    if (!element) {
      return
    }
    const attached = attachedRef.current
    if (attached?.element !== element || attached.teamId !== teamId) {
      attachedRef.current = { element, teamId }
      const saved = detachedOffsets.get(teamId)
      followingRef.current = saved === undefined
      restoreRef.current = saved ?? null
      previousDistanceRef.current = Number.POSITIVE_INFINITY
    }
    if (element.clientHeight <= 0) {
      return
    }
    const maxOffset = Math.max(0, element.scrollHeight - element.clientHeight)
    const restore = restoreRef.current
    if (restore !== null) {
      if (maxOffset >= restore) {
        restoreRef.current = null
        element.scrollTop = restore
      } else if (hasContent) {
        // The remembered offset is past the end of what is there now: land at the end.
        restoreRef.current = null
        followingRef.current = true
      } else {
        return
      }
    }
    if (followingRef.current) {
      element.scrollTop = maxOffset
    }
    const geometry = geometryOf(element)
    previousDistanceRef.current = distanceFromBottom(geometry)
    setShowJump(shouldShowJumpToLatest(followingRef.current, geometry))
  }, [scrollElement, hasContent, teamId])

  // Every render may have grown what the room draws, so every render re-settles.
  useLayoutEffect(() => {
    settleRef.current = settle
    settle()
  })

  useEffect(() => {
    if (!scrollElement || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => settleRef.current())
    observer.observe(scrollElement)
    if (contentElement) {
      observer.observe(contentElement)
    }
    return () => observer.disconnect()
  }, [scrollElement, contentElement])

  const onScroll = useCallback<UIEventHandler<HTMLDivElement>>(
    (event) => {
      const element = event.currentTarget
      if (restoreRef.current !== null || element.clientHeight <= 0) {
        return
      }
      const geometry = geometryOf(element)
      const distance = distanceFromBottom(geometry)
      // Only a move away from the end detaches; a settle or a shrink never does.
      const movedAway =
        distance > previousDistanceRef.current && distance > NATIVE_CHAT_FOLLOW_REARM_PX
      followingRef.current =
        !movedAway && (followingRef.current || isNearBottom(geometry, NATIVE_CHAT_FOLLOW_REARM_PX))
      previousDistanceRef.current = distance
      if (followingRef.current) {
        detachedOffsets.delete(teamId)
      } else {
        detachedOffsets.set(teamId, element.scrollTop)
      }
      setShowJump(shouldShowJumpToLatest(followingRef.current, geometry))
    },
    [teamId]
  )

  const jumpToEnd = useCallback(() => {
    followingRef.current = true
    detachedOffsets.delete(teamId)
    settle()
  }, [settle, teamId])

  return {
    attachScroll: setScrollElement,
    attachContent: setContentElement,
    showJump,
    onScroll,
    jumpToEnd
  }
}
