import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
  type NativeChatVisualAnnotateEvent,
  type NativeChatVisualAnnotateState
} from '../../../src/shared/native-chat-visual-annotate'
import { MobileNativeChatVisualFrame } from './MobileNativeChatVisualFrame'

type WebViewProps = {
  onMessage: (event: { nativeEvent: { data: string } }) => void
  onLoadEnd: () => void
}

// The WebView is a stub: it keeps the props the frame gives it and records each script injected.
const stub = vi.hoisted(() => {
  const state: {
    props: {
      onMessage: (event: { nativeEvent: { data: string } }) => void
      onLoadEnd: () => void
    } | null
    injected: string[]
    seed: number
  } = { props: null, injected: [], seed: 0 }
  return state
})

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles }
}))

vi.mock('react-native-webview', async () => {
  const React = await import('react')
  const WebView = React.forwardRef<unknown, WebViewProps>(function WebViewStub(props, ref) {
    stub.props = props
    React.useImperativeHandle(ref, () => ({
      injectJavaScript: (script: string) => {
        stub.injected.push(script)
      }
    }))
    return null
  })
  return { WebView }
})

// The frame draws two random values in order: its token first, then its channel.
vi.mock('expo-crypto', () => ({
  getRandomBytes: (length: number) => {
    stub.seed += 1
    return new Uint8Array(length).fill(stub.seed)
  }
}))

vi.mock('../platform/external-link', () => ({ openExternalLink: vi.fn() }))

const TOKEN = '01'.repeat(16)
const CHANNEL = '02'.repeat(16)
const ELEMENT = {
  selector: 'main > h1',
  label: 'heading',
  htmlSnippet: '<h1>Checkout</h1>',
  rect: { x: 0, y: 0, width: 100, height: 24 },
  state: {
    text: 'Checkout',
    color: '#171717',
    bg: '#ffffff',
    width: { value: 100, unit: '%' },
    height: { value: 0, unit: 'auto' },
    fontSize: 20
  }
}
const ANNOTATE: NativeChatVisualAnnotateState = { enabled: true, pins: [], overrides: [] }

type FrameOptions = {
  annotate?: NativeChatVisualAnnotateState
  onAnnotateEvent?: (event: NativeChatVisualAnnotateEvent) => void
}

function frameElement({ annotate, onAnnotateEvent }: FrameOptions) {
  return createElement(MobileNativeChatVisualFrame, {
    html: '<main>Checkout</main>',
    title: 'Prototype',
    mode: 'fullscreen',
    onFailed: () => {},
    annotate,
    onAnnotateEvent
  })
}

function mount(options: FrameOptions): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(frameElement(options))
  })
  if (renderer === undefined) {
    throw new Error('the frame did not mount')
  }
  return renderer
}

function update(renderer: ReactTestRenderer, options: FrameOptions): void {
  act(() => {
    renderer.update(frameElement(options))
  })
}

/** A message as the host document relays it: the frame's own token, around the visual's data. */
function fromHostDocument(data: unknown, token = TOKEN): void {
  const onMessage = stub.props?.onMessage
  if (onMessage === undefined) {
    throw new Error('the WebView has no message handler')
  }
  act(() => {
    onMessage({ nativeEvent: { data: JSON.stringify({ kind: 'frame', token, data }) } })
  })
}

describe('MobileNativeChatVisualFrame annotate wiring', () => {
  beforeEach(() => {
    stub.props = null
    stub.injected.length = 0
    stub.seed = 0
  })

  it('hands a picked element to onAnnotateEvent, and a pin click too', () => {
    const onAnnotateEvent = vi.fn()
    mount({ annotate: ANNOTATE, onAnnotateEvent })
    fromHostDocument({
      type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
      channel: CHANNEL,
      element: ELEMENT
    })
    fromHostDocument({
      type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
      channel: CHANNEL,
      pinKey: 'pin-1'
    })
    expect(onAnnotateEvent).toHaveBeenNthCalledWith(1, { kind: 'element-picked', element: ELEMENT })
    expect(onAnnotateEvent).toHaveBeenNthCalledWith(2, { kind: 'pin-clicked', pinKey: 'pin-1' })
  })

  it('drops a report with another token, from another channel, or with a malformed element', () => {
    const onAnnotateEvent = vi.fn()
    mount({ annotate: ANNOTATE, onAnnotateEvent })
    fromHostDocument(
      { type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, channel: CHANNEL, element: ELEMENT },
      'f'.repeat(32)
    )
    fromHostDocument({
      type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
      channel: 'c'.repeat(32),
      element: ELEMENT
    })
    fromHostDocument({
      type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
      channel: CHANNEL,
      element: { ...ELEMENT, label: '' }
    })
    expect(onAnnotateEvent).not.toHaveBeenCalled()
  })

  it('reports no annotate event for a visual that was not built with annotate', () => {
    const onAnnotateEvent = vi.fn()
    mount({ onAnnotateEvent })
    fromHostDocument({
      type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
      channel: CHANNEL,
      element: ELEMENT
    })
    expect(onAnnotateEvent).not.toHaveBeenCalled()
  })

  it('sends the annotate state when its content changes, not for an equal state from a re-render', () => {
    const renderer = mount({ annotate: ANNOTATE })
    expect(stub.injected).toHaveLength(1)

    update(renderer, { annotate: { ...ANNOTATE, pins: [] } })
    expect(stub.injected).toHaveLength(1)

    update(renderer, { annotate: { ...ANNOTATE, enabled: false } })
    expect(stub.injected).toHaveLength(2)
  })

  it('sends the current annotate state again once the host document loads', () => {
    mount({ annotate: ANNOTATE })
    act(() => {
      stub.props?.onLoadEnd()
    })
    expect(stub.injected).toHaveLength(2)
    expect(stub.injected[0]).toBe(stub.injected[1])
  })
})
