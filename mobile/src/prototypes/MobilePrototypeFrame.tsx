import { useCallback, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import type {
  NativeChatVisualAnnotateEvent,
  NativeChatVisualAnnotateState
} from '../../../src/shared/native-chat-visual-annotate'
import type { PrototypeViewport } from '../../../src/shared/prototype-set-state'
import { MobileNativeChatVisualFrame } from '../session/MobileNativeChatVisualFrame'
import { colors } from '../theme/mobile-theme'
import { prototypeFrameLayout } from './mobile-prototype-frame-layout'
import type { MobilePrototypeFileHtml } from './use-mobile-prototype-file'

const AREA_PADDING = 16

/**
 * One prototype on screen: blank while it loads, one line when it cannot be opened, else the live
 * page with its annotate state. A page that stops answering is reported like an unreadable one.
 */
export function MobilePrototypeFrame({
  file,
  fileKey,
  viewport,
  annotate,
  onAnnotateEvent
}: {
  file: MobilePrototypeFileHtml
  fileKey: string
  viewport: PrototypeViewport
  annotate: NativeChatVisualAnnotateState
  onAnnotateEvent: (event: NativeChatVisualAnnotateEvent) => void
}) {
  const [available, setAvailable] = useState({ width: 0, height: 0 })
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const onFailed = useCallback(() => setFailedKey(fileKey), [fileKey])
  const layout = prototypeFrameLayout(viewport, available)
  const unreadable = file.status === 'error' || failedKey === fileKey

  return (
    <View
      style={styles.area}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout
        setAvailable({ width: width - AREA_PADDING * 2, height: height - AREA_PADDING * 2 })
      }}
    >
      {layout === null ? null : (
        <View style={[styles.box, { width: layout.boxWidth, height: layout.boxHeight }]}>
          {unreadable ? (
            <Text style={styles.error}>Couldn't open this prototype</Text>
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
