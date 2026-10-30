import { useCallback, useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'
import {
  MERGE_PREVIEW_COMPOSER_DOCUMENT,
  mergePreviewComposeScript,
  readMergePreviewResponse,
  type MergePreviewRequest,
  type MergePreviewResponse
} from './mobile-merge-preview-composer'

const COMPOSER_SOURCE = { html: MERGE_PREVIEW_COMPOSER_DOCUMENT }

// Only the composer's own document loads; anything else is refused, not opened.
function allowsLoad(request: ShouldStartLoadRequest): boolean {
  return request.url === 'about:blank'
}

/**
 * A hidden WebView that finds each kept part's element in its direction's HTML. It runs only the
 * composer script, with no network, and answers each request with sanitized fragments. It is never
 * shown, and a failure answers the current request with `ok: false`.
 */
export function MobilePrototypeMergeComposer({
  request,
  onResponse
}: {
  /** The request to answer; null while the directions are still being read. */
  request: MergePreviewRequest | null
  onResponse: (response: MergePreviewResponse) => void
}) {
  const webView = useRef<WebView>(null)
  const loaded = useRef(false)
  const pending = useRef<MergePreviewRequest | null>(null)
  const sentId = useRef<number | null>(null)

  const send = useCallback((next: MergePreviewRequest) => {
    sentId.current = next.requestId
    webView.current?.injectJavaScript(mergePreviewComposeScript(next))
  }, [])

  useEffect(() => {
    if (request === null) {
      return
    }
    if (loaded.current) {
      send(request)
    } else {
      pending.current = request
    }
  }, [request, send])

  const onLoadEnd = useCallback(() => {
    loaded.current = true
    const next = pending.current
    pending.current = null
    if (next !== null) {
      send(next)
    }
  }, [send])

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const response = readMergePreviewResponse(event.nativeEvent.data)
      if (response !== null) {
        onResponse(response)
      }
    },
    [onResponse]
  )

  const onFailed = useCallback(() => {
    const requestId = sentId.current ?? pending.current?.requestId ?? null
    if (requestId !== null) {
      onResponse({ requestId, ok: false })
    }
  }, [onResponse])

  return (
    <View pointerEvents="none" style={styles.host}>
      <WebView
        ref={webView}
        source={COMPOSER_SOURCE}
        originWhitelist={['about:blank']}
        onShouldStartLoadWithRequest={allowsLoad}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        domStorageEnabled={false}
        allowFileAccess={false}
        mixedContentMode="never"
        onLoadEnd={onLoadEnd}
        onMessage={onMessage}
        onError={onFailed}
        onRenderProcessGone={onFailed}
        onContentProcessDidTerminate={onFailed}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  host: { position: 'absolute', width: 1, height: 1, opacity: 0 }
})
