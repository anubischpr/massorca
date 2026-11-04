// The Conference room's scroll on the phone: it opens at the latest message, follows
// it while the reader is at the end, and returns a team's room to the offset the reader
// left it at. The tail follow is the chat's own; this adds the per-team memory, because
// the page remounts the room when the reader leaves it.

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { NativeScrollEvent, ScrollView } from 'react-native'
import {
  isAtTail,
  useMobileNativeChatTailFollow
} from '../session/use-mobile-native-chat-tail-follow'

/** Offsets of rooms the reader left scrolled up, by team. Kept for the session. */
const detachedOffsets = new Map<string, number>()

type LayoutEvent = { nativeEvent: { layout: { height: number } } }
type ScrollEvent = { nativeEvent: NativeScrollEvent }

export function useMobileBotTeamRoomScroll({
  teamId,
  hasItems
}: {
  teamId: string
  /** Whether the room has anything to show; a remembered offset waits for it. */
  hasItems: boolean
}) {
  const tail = useMobileNativeChatTailFollow<unknown, ScrollView>({
    hasItems,
    sendSurfaceId: teamId
  })
  const {
    listRef,
    detachFromTail,
    jumpToTail,
    pinToTail,
    pinToTailAfterContentResize,
    recordScrollMetrics
  } = tail
  const viewportRef = useRef<number | null>(null)
  const restoreRef = useRef<number | null>(null)
  const [restoring, setRestoring] = useState(false)

  // Before the first measurements, so the tail does not pin over the remembered position.
  useLayoutEffect(() => {
    const saved = detachedOffsets.get(teamId)
    restoreRef.current = saved ?? null
    setRestoring(saved !== undefined)
    if (saved !== undefined) {
      detachFromTail()
    }
  }, [teamId, detachFromTail])

  const onLayout = useCallback(
    (event: LayoutEvent) => {
      viewportRef.current = event.nativeEvent.layout.height
      pinToTail(event)
    },
    [pinToTail]
  )

  const onContentSizeChange = useCallback(
    (width: number, height: number) => {
      pinToTailAfterContentResize(width, height)
      const saved = restoreRef.current
      const viewport = viewportRef.current
      if (saved === null || viewport === null) {
        return
      }
      if (height - viewport >= saved) {
        restoreRef.current = null
        setRestoring(false)
        listRef.current?.scrollTo?.({ y: saved, animated: false })
      } else if (hasItems) {
        // The remembered offset is past the end of what is there now: land at the end.
        restoreRef.current = null
        setRestoring(false)
        jumpToTail()
      }
    },
    [hasItems, jumpToTail, listRef, pinToTailAfterContentResize]
  )

  const onScroll = useCallback(
    (event: ScrollEvent) => {
      recordScrollMetrics(event.nativeEvent)
      if (restoreRef.current !== null) {
        return
      }
      if (isAtTail(event.nativeEvent)) {
        detachedOffsets.delete(teamId)
      } else {
        detachedOffsets.set(teamId, event.nativeEvent.contentOffset.y)
      }
    },
    [recordScrollMetrics, teamId]
  )

  return {
    listRef,
    listScrollProps: tail.listScrollProps,
    showJumpToTail: tail.showJumpToTail && !restoring,
    onLayout,
    onContentSizeChange,
    onScroll,
    jumpToTail,
    beginUserScroll: tail.beginUserScroll,
    endUserDrag: tail.endUserDrag,
    beginMomentum: tail.beginMomentum,
    endMomentum: tail.endMomentum
  }
}
