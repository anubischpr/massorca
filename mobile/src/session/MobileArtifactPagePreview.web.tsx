import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
// The native component's own prop type, so a change to it fails here rather than drifting.
import type { MobileArtifactPagePreviewProps } from './MobileArtifactPagePreview'
import {
  THUMBNAIL_RENDER_WIDTH,
  thumbnailDocument,
  thumbnailScale
} from './mobile-artifact-thumbnail-html'

/**
 * Web sibling, inside the hybrid shell's page: the same inert page, in a sandboxed frame.
 *
 * An empty `sandbox` runs nothing and navigates nothing, which is what the native WebView's settings
 * ask for, and `react-native-webview` stays out of the page bundle, where it cannot render.
 */
export function MobileArtifactPagePreview({ html, width, height }: MobileArtifactPagePreviewProps) {
  const document = useMemo(() => thumbnailDocument(html), [html])
  const scale = thumbnailScale(width)
  const pageHeight = scale > 0 ? height / scale : height
  return (
    <View pointerEvents="none" style={[styles.clip, { width, height }]}>
      <View
        style={[
          styles.page,
          {
            width: THUMBNAIL_RENDER_WIDTH,
            height: pageHeight,
            left: -(THUMBNAIL_RENDER_WIDTH * (1 - scale)) / 2,
            top: -(pageHeight * (1 - scale)) / 2,
            transform: [{ scale }]
          }
        ]}
      >
        <iframe
          title="Page preview"
          sandbox=""
          srcDoc={document}
          referrerPolicy="no-referrer"
          style={IFRAME_STYLE}
        />
      </View>
    </View>
  )
}

/** A DOM style, not a `StyleSheet` entry: this element is an `iframe` and not a react-native view. */
const IFRAME_STYLE = {
  border: 'none',
  width: '100%',
  height: '100%',
  backgroundColor: '#ffffff'
} as const

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden'
  },
  page: {
    position: 'absolute'
  }
})
