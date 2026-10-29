import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState
} from '../../../src/shared/native-chat-visual-annotate'
import type { PrototypeViewport } from '../../../src/shared/prototype-set-state'
import { MobileNativeChatVisualFrame } from '../session/MobileNativeChatVisualFrame'
import { colors } from '../theme/mobile-theme'
import { capturePrototypePin } from './mobile-prototype-capture'
import type { MobilePrototypeFrameHandle } from './mobile-prototype-capture-math'
import { prototypeFrameLayout } from './mobile-prototype-frame-layout'
import type { MobilePrototypeFileHtml } from './use-mobile-prototype-file'

const AREA_PADDING = 16

/** The one line a prototype that cannot be opened shows. */
export const PROTOTYPE_UNREADABLE_LINE = "Couldn't open this prototype"

/**
 * One prototype on screen: blank while it loads, one line when it cannot be opened, else the live
 * page with its annotate state. A page that stops answering is reported like an unreadable one, and
 * the report lasts only for that read: a read that succeeds again shows the page.
 */
export function MobilePrototypeFrame({
  file,
  fileKey,
  viewport,
  annotate,
  onAnnotateEvent,
  handle
}: {
  file: MobilePrototypeFileHtml
  fileKey: string
  viewport: PrototypeViewport
  annotate: NativeChatVisualAnnotateState
  onAnnotateEvent: (event: NativeChatVisualAnnotateEvent) => void
  /** Set while a page is drawn in the frame, null otherwise. */
  handle: MutableRefObject<MobilePrototypeFrameHandle | null>
}) {
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  // The read that failed, with its key: a new read is a new object, so it is not reported as failed.
  const [failure, setFailure] = useState<{ fileKey: string; file: MobilePrototypeFileHtml } | null>(
    null
  )
  const onFailed = useCallback(() => setFailure({ fileKey, file }), [fileKey, file])
  const layout = prototypeFrameLayout(viewport, available)
  const unreadable =
    file.status === 'error' ||
    (failure !== null && failure.fileKey === fileKey && failure.file === file)
  const box = useRef<View>(null)
  const showsPage = layout !== null && !unreadable && file.status === 'ready'
  // The handle depends on the numbers it uses, not on the layout object, which is new on every render.
  const designWidth = layout?.designWidth ?? 0
  const designHeight = layout?.designHeight ?? 0
  const scale = layout?.scale ?? 1
  const boxWidth = layout?.boxWidth ?? 0
  const boxHeight = layout?.boxHeight ?? 0
  useEffect(() => {
    if (!showsPage) {
      handle.current = null
      return
    }
    handle.current = {
      pageSize: { width: designWidth, height: designHeight },
      capturePin: (rect) =>
        capturePrototypePin({
          frame: box,
          frameSize: { width: boxWidth, height: boxHeight },
          scale,
          rect
        })
    }
    return () => {
      handle.current = null
    }
  }, [handle, showsPage, designWidth, designHeight, scale, boxWidth, boxHeight])

  return (
    <View
      style={styles.area}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout
        setAvailable({ width: width - AREA_PADDING * 2, height: height - AREA_PADDING * 2 })
      }}
    >
      {layout === null ? null : (
        <View
          ref={box}
          collapsable={false}
          style={[styles.box, { width: layout.boxWidth, height: layout.boxHeight }]}
        >
          {unreadable ? (
            <Text style={styles.error}>{PROTOTYPE_UNREADABLE_LINE}</Text>
          ) : file.status === 'ready' ? (
            <View
              style={[
                styles.page,
                {
                  width: layout.designWidth,
                  height: layout.designHeight,
                  left: -(layout.designWidth * (1 - layout.scale)) / 2,
                  top: -(layout.designHeight * (1 - layout.scale)) / 2,
                  transform: [{ scale: layout.scale }]
                }
              ]}
            >
              <MobileNativeChatVisualFrame
                key={fileKey}
                html={file.html}
                title="Prototype"
                mode="fullscreen"
                onFailed={onFailed}
                annotate={annotate}
                onAnnotateEvent={onAnnotateEvent}
              />
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    alignItems: 'center',
    padding: AREA_PADDING,
    backgroundColor: colors.editorSurface
  },
  box: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: colors.surfaceBright
  },
  page: {
    position: 'absolute'
  },
  error: {
    padding: 24,
    color: colors.bgBase,
    fontSize: 14
  }
})
