import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileArtifactPagePreview } from './MobileArtifactPagePreview'

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View'
}))
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }))

describe('MobileArtifactPagePreview', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(width: number, height: number) {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileArtifactPagePreview, {
          html: '<head></head><h1>Hi</h1>',
          width,
          height
        })
      )
    })
    return mounted
  }

  it('draws an inert page: no touches, no scripts, no scrolling, and no outside loads', () => {
    const mounted = mount(195, 110)
    expect(mounted.root.find((node) => String(node.type) === 'View').props.pointerEvents).toBe(
      'none'
    )
    const web = mounted.root.find((node) => String(node.type) === 'WebView')
    expect(web.props.javaScriptEnabled).toBe(false)
    expect(web.props.scrollEnabled).toBe(false)
    expect(web.props.originWhitelist).toEqual(['about:blank'])
    expect(web.props.onShouldStartLoadWithRequest({ url: 'https://example.com/x' })).toBe(false)
    expect(web.props.onShouldStartLoadWithRequest({ url: 'about:blank' })).toBe(true)
    expect(web.props.source.html).toContain('Content-Security-Policy')
  })

  it('scales the 390px render width into the tile and keeps its corner in place', () => {
    const mounted = mount(195, 110)
    const page = mounted.root.findAll((node) => String(node.type) === 'View')[1]
    const scale = 0.5
    expect(page.props.style[1].transform).toEqual([{ scale }])
    expect(page.props.style[1].width).toBe(390)
    expect(page.props.style[1].left).toBeCloseTo(-(390 * (1 - scale)) / 2)
    expect(page.props.style[1].top).toBeCloseTo(-(220 * (1 - scale)) / 2)
  })
})
