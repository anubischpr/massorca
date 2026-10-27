import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import {
  THUMBNAIL_RENDER_WIDTH,
  thumbnailDocument,
  thumbnailScale
} from './mobile-artifact-thumbnail-html'

export type MobileArtifactPagePreviewProps = {
  html: string
  /** The tile's size on screen; the page renders at the phone width and shrinks to fill it. */
  width: number
  height: number
}

/**
 * A page drawn small and inert: scripts off, no network, no touches. The tile under it takes the
 * tap. The page is laid out at the render width, then scaled about its centre, so the top-left
 * corner is moved back to the tile's corner.
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
        <WebView
          style={styles.webview}
          source={{ html: document }}
          javaScriptEnabled={false}
          scrollEnabled={false}
          originWhitelist={['about:blank']}
          // Why: the only load is the inline document; a request for anything else is refused.
          onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden'
  },
  page: {
    position: 'absolute'
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff'
  }
})
