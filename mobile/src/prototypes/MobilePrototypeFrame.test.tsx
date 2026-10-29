import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { MobilePrototypeFrameHandle } from './mobile-prototype-capture-math'
import type { MobilePrototypeFileHtml } from './use-mobile-prototype-file'
import { MobilePrototypeFrame, PROTOTYPE_UNREADABLE_LINE } from './MobilePrototypeFrame'

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))

// The WebView is a host stub here: a test reports its failure through `onFailed`.
vi.mock('../session/MobileNativeChatVisualFrame', () => ({
  MobileNativeChatVisualFrame: 'MobileNativeChatVisualFrame'
}))

vi.mock('./mobile-prototype-capture', () => ({ capturePrototypePin: vi.fn() }))

type FrameProps = {
  file: MobilePrototypeFileHtml
  handle: { current: MobilePrototypeFrameHandle | null }
  fileKey?: string
}

const READY: MobilePrototypeFileHtml = { status: 'ready', html: '<main>Checkout A</main>' }

function frameElement({ file, handle, fileKey = 'request-1:A.html' }: FrameProps) {
  return createElement(MobilePrototypeFrame, {
    file,
    fileKey,
    viewport: 'desktop',
    annotate: { enabled: false, pins: [], overrides: [] },
    onAnnotateEvent: () => {},
    handle
  })
}

function mount(props: FrameProps): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(frameElement(props))
  })
  if (renderer === undefined) {
    throw new Error('the frame did not mount')
  }
  return renderer
}

/** The host elements of one type; the test doubles for View, Text and the WebView are host strings. */
function hosts(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => node.type === type)
}

/** The frame measures its area: the first host View is the area, with its own layout handler. */
function layOut(renderer: ReactTestRenderer): void {
  const [area] = hosts(renderer, 'View')
  act(() => {
    area?.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } } })
  })
}

function shownText(renderer: ReactTestRenderer): string[] {
  return hosts(renderer, 'Text').map((text) => String(text.props.children))
}

describe('MobilePrototypeFrame', () => {
  it('shows the live page once it is laid out, and offers its size to a capture', () => {
    const handle: FrameProps['handle'] = { current: null }
    const renderer = mount({ file: READY, handle })
    expect(hosts(renderer, 'MobileNativeChatVisualFrame')).toHaveLength(0)
    layOut(renderer)
    expect(hosts(renderer, 'MobileNativeChatVisualFrame')).toHaveLength(1)
    expect(handle.current?.pageSize.width).toBe(640)
  })

  it('shows the one approved line when the page fails, and shows the page again after a fresh read', () => {
    const handle: FrameProps['handle'] = { current: null }
    const renderer = mount({ file: READY, handle })
    layOut(renderer)
    act(() => {
      hosts(renderer, 'MobileNativeChatVisualFrame')[0]?.props.onFailed()
    })
    expect(shownText(renderer)).toEqual([PROTOTYPE_UNREADABLE_LINE])
    expect(handle.current).toBeNull()

    // The read that replaces the failed one is a new read, so the page is shown again.
    act(() => {
      renderer.update(
        frameElement({ file: { status: 'ready', html: '<main>Checkout A</main>' }, handle })
      )
    })
    expect(hosts(renderer, 'MobileNativeChatVisualFrame')).toHaveLength(1)
    expect(shownText(renderer)).toEqual([])
    expect(handle.current?.pageSize.width).toBe(640)
  })

  it('keeps the same capture handle across renders that leave the frame the same size', () => {
    const handle: FrameProps['handle'] = { current: null }
    const renderer = mount({ file: READY, handle })
    layOut(renderer)
    const first = handle.current
    act(() => {
      renderer.update(frameElement({ file: READY, handle }))
    })
    expect(handle.current).toBe(first)
  })

  it('shows nothing while the page loads', () => {
    const handle: FrameProps['handle'] = { current: null }
    const renderer = mount({ file: { status: 'loading' }, handle })
    layOut(renderer)
    expect(hosts(renderer, 'MobileNativeChatVisualFrame')).toHaveLength(0)
    expect(shownText(renderer)).toEqual([])
    expect(handle.current).toBeNull()
  })
})
