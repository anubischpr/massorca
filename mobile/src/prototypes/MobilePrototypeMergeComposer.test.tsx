import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobilePrototypeMergeComposer } from './MobilePrototypeMergeComposer'
import type { MergePreviewRequest, MergePreviewResponse } from './mobile-merge-preview-composer'

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View'
}))
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }))

const REQUEST: MergePreviewRequest = {
  requestId: 1,
  directions: { A: '<h1>A</h1>' },
  parts: [{ id: 0, from: 'A', selector: 'h1' }]
}

/** A host element by its type name; the mocked native components are host strings. */
function isHost(node: ReactTestInstance, type: string): boolean {
  return node.type === type
}

function mount(
  request: MergePreviewRequest | null,
  onResponse = vi.fn<(r: MergePreviewResponse) => void>()
) {
  const injectJavaScript = vi.fn<(script: string) => void>()
  const element = (next: MergePreviewRequest | null) =>
    createElement(MobilePrototypeMergeComposer, { request: next, onResponse })
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(element(request), {
      createNodeMock: () => ({ injectJavaScript })
    })
  })
  if (renderer === undefined) {
    throw new Error('the composer did not mount')
  }
  const tree = renderer
  const webView = (): ReactTestInstance => {
    const [node] = tree.root.findAll((candidate) => isHost(candidate, 'WebView'))
    if (node === undefined) {
      throw new Error('no composer page')
    }
    return node
  }
  return {
    webView,
    injectJavaScript,
    onResponse,
    setRequest: (next: MergePreviewRequest | null) => {
      act(() => {
        tree.update(element(next))
      })
    }
  }
}

describe('the composer page', () => {
  it('runs scripts with no network, and loads only its own page', () => {
    const { webView } = mount(null)
    const props = webView().props
    expect(props.javaScriptEnabled).toBe(true)
    expect(props.originWhitelist).toEqual(['about:blank'])
    expect(props.domStorageEnabled).toBe(false)
    expect(props.allowFileAccess).toBe(false)
    expect(props.onShouldStartLoadWithRequest({ url: 'https://example.com/' })).toBe(false)
    expect(props.onShouldStartLoadWithRequest({ url: 'about:blank' })).toBe(true)
    expect(props.source.html).toContain("default-src 'none'")
  })
})

describe('sending a request', () => {
  it('waits for the page to load before the first request, then sends it', () => {
    const { webView, injectJavaScript } = mount(REQUEST)
    expect(injectJavaScript).not.toHaveBeenCalled()
    act(() => webView().props.onLoadEnd())
    expect(injectJavaScript).toHaveBeenCalledTimes(1)
    expect(injectJavaScript.mock.calls[0]?.[0]).toContain('window.__orcaComposeMergePreview(')
  })

  it('sends a later request as soon as the page is loaded', () => {
    const { webView, injectJavaScript, setRequest } = mount(null)
    act(() => webView().props.onLoadEnd())
    setRequest({ ...REQUEST, requestId: 2 })
    expect(injectJavaScript).toHaveBeenCalledTimes(1)
    expect(injectJavaScript.mock.calls[0]?.[0]).toContain('"requestId":2')
  })
})

describe('the answers', () => {
  it('passes on each message the page posts that it can read', () => {
    const { webView, onResponse } = mount(REQUEST)
    act(() =>
      webView().props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ requestId: 1, ok: true, css: {}, outer: { '0': null } })
        }
      })
    )
    act(() => webView().props.onMessage({ nativeEvent: { data: 'not a reply' } }))
    expect(onResponse).toHaveBeenCalledTimes(1)
    expect(onResponse).toHaveBeenCalledWith({
      requestId: 1,
      ok: true,
      css: {},
      outer: { '0': null }
    })
  })

  it('answers the request in flight with a failure when the page cannot run', () => {
    const { webView, onResponse, setRequest, injectJavaScript } = mount(REQUEST)
    act(() => webView().props.onLoadEnd())
    setRequest({ ...REQUEST, requestId: 9 })
    expect(injectJavaScript).toHaveBeenCalledTimes(2)
    act(() => webView().props.onRenderProcessGone())
    expect(onResponse).toHaveBeenLastCalledWith({ requestId: 9, ok: false })
  })
})
