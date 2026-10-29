import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { FlatList, NativeScrollEvent } from 'react-native'
import { mobileNativeChatListScrollProps } from './mobile-native-chat-list-scroll-props'

/** Distance from the bottom, in points, still treated as "at the tail". */
const AT_TAIL_SLOP = 80
/** A re-measure smaller than this is not a resize worth re-pinning for. */
const RESIZE_EPSILON = 1

type PinnedGeometry = { content: number | null; viewport: number | null }
/** The scroll geometry the hook reads; RN scroll events carry it. */
type TailScrollMetrics = Pick<
  NativeScrollEvent,
  'contentOffset' | 'contentSize' | 'layoutMeasurement'
>
type TailScrollEvent = { nativeEvent: TailScrollMetrics }
/** The viewport size the hook reads; RN layout events carry it. */
type TailLayoutEvent = { nativeEvent: { layout: { height: number } } }

function sameExtent(left: number | null, right: number | null): boolean {
  return (
    left === right || (left !== null && right !== null && Math.abs(left - right) < RESIZE_EPSILON)
  )
}

function isAtTail(event: TailScrollMetrics): boolean {
  const { contentOffset, contentSize, layoutMeasurement } = event
  return contentSize.height - (contentOffset.y + layoutMeasurement.height) <= AT_TAIL_SLOP
}

export type MobileNativeChatTailFollow<TItem> = {
  /** Attach to the transcript list; the hook scrolls through this ref alone. */
  listRef: RefObject<FlatList<TItem> | null>
  /** Render flag for the jump-to-latest control. */
  showJumpToTail: boolean
  /** Spread onto the transcript list; anchors visible rows only once the tail is left. */
  listScrollProps: ReturnType<typeof mobileNativeChatListScrollProps>
  /** Passive maintenance: re-pin after the viewport resizes. */
  pinToTail: (event?: TailLayoutEvent) => void
  /** Content-size maintenance using the list's authoritative measured height. */
  pinToTailAfterContentResize: (_width: number, height: number) => void
  /** Explicit jump — send, or the jump-to-latest control. Resumes following. */
  jumpToTail: () => void
  beginUserScroll: () => void
  endUserDrag: (event: TailScrollEvent) => void
  beginMomentum: () => void
  endMomentum: (event: TailScrollEvent) => void
  /** Leave the tail deliberately, e.g. before prepending older history. */
  detachFromTail: () => void
  recordScrollMetrics: (event: TailScrollMetrics) => void
}

/** Sole owner of transcript scroll position.
 *
 *  Streaming used to have several tail-followers at once: a delayed *animated*
 *  `scrollToEnd` alongside an immediate non-animated one on content growth. The
 *  animated command eases toward the endpoint measured when it started, so while
 *  tokens kept arriving it ran backwards until the content-size pin yanked it
 *  forward — the visible drift-then-snap. One owner, never animated, removes it.
 *
 *  Intent (`following`) is kept separate from geometry (at-tail): a programmatic
 *  scroll reports metrics like any other, so letting metrics decide intent let
 *  the view argue with itself. Only the user's own gestures and explicit jumps
 *  move intent; metrics only decide where a *released* gesture leaves us.
 *
 *  Passive pins fire only for a real resize, once per frame, and land on the list's
 *  own end: pinning to the raw content height overshot the end by a viewport, the
 *  virtualized list re-windowed and re-measured, and that re-measure pinned again,
 *  so the view bounced even with nothing streaming.
 */
export function useMobileNativeChatTailFollow<TItem>(args: {
  /** Guards `scrollToEnd` against an empty list. */
  hasItems: boolean
  /** Conversation identity; the transcript list remounts per conversation. */
  sendSurfaceId: string
}): MobileNativeChatTailFollow<TItem> {
  const { hasItems, sendSurfaceId: scopeKey } = args
  const listRef = useRef<FlatList<TItem> | null>(null)
  const [following, setFollowingFlag] = useState(true)
  const [atTail, setAtTailFlag] = useState(true)
  // Event handlers read intent at event time, before a re-render lands.
  const followingRef = useRef(true)
  const atTailRef = useRef(true)
  const userScrollActiveRef = useRef(false)
  const userScrollSettleFrameRef = useRef<number | null>(null)
  const passivePinFrameRef = useRef<number | null>(null)
  const geometryRef = useRef<PinnedGeometry>({ content: null, viewport: null })
  const pinnedGeometryRef = useRef<PinnedGeometry | null>(null)
  const scopeKeyRef = useRef(scopeKey)

  // Reset during render, before the fresh list mounts and reports its first measurements.
  if (scopeKeyRef.current !== scopeKey) {
    scopeKeyRef.current = scopeKey
    userScrollActiveRef.current = false
    geometryRef.current = { content: null, viewport: null }
    pinnedGeometryRef.current = null
    followingRef.current = true
    atTailRef.current = true
    if (!following) {
      setFollowingFlag(true)
    }
    if (!atTail) {
      setAtTailFlag(true)
    }
  }

  // Single writer, so the event-time ref and the render flag cannot disagree.
  const setFollowing = useCallback((next: boolean) => {
    if (followingRef.current === next) {
      return
    }
    followingRef.current = next
    setFollowingFlag(next)
  }, [])

  const setAtTail = useCallback((next: boolean) => {
    if (atTailRef.current === next) {
      return
    }
    atTailRef.current = next
    setAtTailFlag(next)
  }, [])

  const clearPassivePin = useCallback(() => {
    if (passivePinFrameRef.current !== null) {
      cancelAnimationFrame(passivePinFrameRef.current)
      passivePinFrameRef.current = null
    }
  }, [])

  const scrollToTailNow = useCallback(() => {
    clearPassivePin()
    if (!followingRef.current || !hasItems) {
      return
    }
    pinnedGeometryRef.current = { ...geometryRef.current }
    listRef.current?.scrollToEnd({ animated: false })
  }, [clearPassivePin, hasItems])

  const schedulePassivePin = useCallback(() => {
    if (!followingRef.current || !hasItems || passivePinFrameRef.current !== null) {
      return
    }
    const pinned = pinnedGeometryRef.current
    const geometry = geometryRef.current
    if (
      pinned &&
      sameExtent(pinned.content, geometry.content) &&
      sameExtent(pinned.viewport, geometry.viewport)
    ) {
      return
    }
    passivePinFrameRef.current = requestAnimationFrame(() => {
      passivePinFrameRef.current = null
      scrollToTailNow()
    })
  }, [hasItems, scrollToTailNow])

  const pinToTail = useCallback(
    (event?: TailLayoutEvent) => {
      if (event) {
        geometryRef.current = { ...geometryRef.current, viewport: event.nativeEvent.layout.height }
      }
      schedulePassivePin()
    },
    [schedulePassivePin]
  )

  const pinToTailAfterContentResize = useCallback(
    (_width: number, height: number) => {
      geometryRef.current = { ...geometryRef.current, content: height }
      schedulePassivePin()
    },
    [schedulePassivePin]
  )

  const clearUserScrollSettle = useCallback(() => {
    if (userScrollSettleFrameRef.current !== null) {
      cancelAnimationFrame(userScrollSettleFrameRef.current)
      userScrollSettleFrameRef.current = null
    }
  }, [])

  const recordScrollMetrics = useCallback(
    (event: TailScrollMetrics) => setAtTail(isAtTail(event)),
    [setAtTail]
  )

  const jumpToTail = useCallback(() => {
    clearUserScrollSettle()
    userScrollActiveRef.current = false
    setAtTail(true)
    setFollowing(true)
    scrollToTailNow()
  }, [clearUserScrollSettle, scrollToTailNow, setAtTail, setFollowing])

  const beginUserScroll = useCallback(() => {
    clearUserScrollSettle()
    clearPassivePin()
    userScrollActiveRef.current = true
    setFollowing(false)
  }, [clearPassivePin, clearUserScrollSettle, setFollowing])

  const finishUserScroll = useCallback(
    (finishedAtTail: boolean) => {
      if (!userScrollActiveRef.current) {
        return
      }
      clearUserScrollSettle()
      userScrollActiveRef.current = false
      setAtTail(finishedAtTail)
      setFollowing(finishedAtTail)
      if (finishedAtTail) {
        scrollToTailNow()
      }
    },
    [clearUserScrollSettle, scrollToTailNow, setAtTail, setFollowing]
  )

  const endUserDrag = useCallback(
    (event: TailScrollEvent) => {
      if (!userScrollActiveRef.current) {
        return
      }
      clearUserScrollSettle()
      const releasedAtTail = isAtTail(event.nativeEvent)
      userScrollSettleFrameRef.current = requestAnimationFrame(() => {
        userScrollSettleFrameRef.current = null
        finishUserScroll(releasedAtTail)
      })
    },
    [clearUserScrollSettle, finishUserScroll]
  )

  const beginMomentum = useCallback(() => {
    if (userScrollActiveRef.current) {
      clearUserScrollSettle()
    }
  }, [clearUserScrollSettle])

  const endMomentum = useCallback(
    (event: TailScrollEvent) => finishUserScroll(isAtTail(event.nativeEvent)),
    [finishUserScroll]
  )

  const detachFromTail = useCallback(() => {
    clearUserScrollSettle()
    clearPassivePin()
    userScrollActiveRef.current = false
    setAtTail(false)
    setFollowing(false)
  }, [clearPassivePin, clearUserScrollSettle, setAtTail, setFollowing])

  useEffect(
    () => () => {
      clearUserScrollSettle()
      clearPassivePin()
    },
    [clearPassivePin, clearUserScrollSettle]
  )

  return {
    listRef,
    showJumpToTail: !following && !atTail,
    listScrollProps: mobileNativeChatListScrollProps(following),
    pinToTail,
    pinToTailAfterContentResize,
    jumpToTail,
    beginUserScroll,
    endUserDrag,
    beginMomentum,
    endMomentum,
    detachFromTail,
    recordScrollMetrics
  }
}
