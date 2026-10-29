import { useState } from 'react'
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { latestVersionOf } from '../../../src/shared/prototype-list-model'
import type {
  PrototypeListedDirection,
  PrototypeListedSet
} from '../../../src/shared/rpc-contract/prototype-params'
import { MobileArtifactPagePreview } from '../session/MobileArtifactPagePreview'
import { useArtifactTileNearViewport } from '../session/mobile-artifact-scroll-scope'
import type { RpcClient } from '../transport/rpc-client'
import { colors } from '../theme/mobile-theme'
import { useMobilePrototypeThumbnailHtml } from './use-mobile-prototype-thumbnail'

/**
 * A live, scaled-down render of a direction's latest version. It takes no touches: the tile around
 * it does. Until the page is read, and when it is not near the screen, it is an empty page.
 */
export function MobilePrototypeTile({
  client,
  set,
  direction,
  style
}: {
  client: RpcClient | null
  set: PrototypeListedSet
  direction: PrototypeListedDirection | undefined
  /** The tile's box; the render fills whatever size it gets. */
  style: StyleProp<ViewStyle>
}) {
  const { ref, near, onLayout } = useArtifactTileNearViewport()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const latest = latestVersionOf(direction)
  const html = useMobilePrototypeThumbnailHtml(
    client,
    latest === null
      ? null
      : { sessionId: set.sessionId, requestId: set.requestId, fileName: latest.fileName },
    near
  )
  return (
    <View
      ref={ref}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.tile, style]}
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout
        setSize({ width, height })
        onLayout()
      }}
    >
      {html !== null && size.width > 0 ? (
        <MobileArtifactPagePreview html={html} width={size.width} height={size.height} />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceBright
  }
})
