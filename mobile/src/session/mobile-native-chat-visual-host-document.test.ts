import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import {
  NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS,
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE
} from '../../../src/shared/native-chat-visual-annotate'
import {
  buildMobileNativeChatVisualHostDocument,
  MOBILE_NATIVE_CHAT_VISUAL_ANNOTATE_COMMAND
} from './mobile-native-chat-visual-host-document'

const TOKEN = 'a'.repeat(32)
const CHANNEL = 'b'.repeat(32)
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

type Listener = (event: { source: unknown; data: unknown }) => void

/**
 * The host document's own script, run in a sandbox with a small DOM: `up` is the app side it posts to,
 * `frameWindow` is the visual's frame, and `listeners` are the window's message handlers.
 */
function runHostDocument() {
  const html = buildMobileNativeChatVisualHostDocument({
    visualDocument: '<p>x</p>',
    channel: CHANNEL,
    token: TOKEN,
    title: 'Prototype',
    mode: 'fullscreen',
    annotate: true
  })
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (script === undefined) {
    throw new Error('the host document has no script')
  }
  const frameWindow = { postMessage: vi.fn() }
  const frame = {
    contentWindow: frameWindow,
    style: {},
    setAttribute: vi.fn(),
    addEventListener: vi.fn(),
    remove: vi.fn()
  }
  const listeners: Listener[] = []
  const up = { postMessage: vi.fn((_text: string) => undefined) }
  const windowStub: Record<string, unknown> = {
    ReactNativeWebView: up,
    addEventListener: (type: string, listener: Listener) => {
      if (type === 'message') {
        listeners.push(listener)
      }
    }
  }
  const documentStub = {
    createElement: () => frame,
    body: { appendChild: () => undefined },
    activeElement: null
  }
  runInNewContext(script, {
    window: windowStub,
    document: documentStub,
    navigator: {},
    setTimeout,
    clearTimeout
  })
  return { up, frameWindow, listeners, windowStub }
}

/** A message from `source` as the visual's frame posts it. */
function deliver(listeners: Listener[], source: unknown, data: unknown): void {
  for (const listener of listeners) {
    listener({ source, data })
  }
}

describe('the host document relays annotate reports from its own frame', () => {
  it('relays a picked element with its own fields, inside the annotate limits', () => {
    const { up, frameWindow, listeners } = runHostDocument()
    deliver(listeners, frameWindow, {
      type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
      channel: CHANNEL,
      element: { ...ELEMENT, unexpected: 'not an element field' }
    })
    expect(up.postMessage).toHaveBeenCalledTimes(1)
    const relayed: unknown = JSON.parse(up.postMessage.mock.calls[0]?.[0] ?? 'null')
    expect(relayed).toEqual({
      kind: 'frame',
      token: TOKEN,
      data: { type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, channel: CHANNEL, element: ELEMENT }
    })
  })

  it('drops a picked element that is not an element or is past its limits', () => {
    const { up, frameWindow, listeners } = runHostDocument()
    const picked = (element: unknown) =>
      deliver(listeners, frameWindow, {
        type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
        channel: CHANNEL,
        element
      })
    picked(null)
    picked('a string')
    picked({ ...ELEMENT, label: '' })
    picked({ ...ELEMENT, selector: 'x'.repeat(NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.selector + 1) })
    picked({ ...ELEMENT, htmlSnippet: 1 })
    expect(up.postMessage).not.toHaveBeenCalled()
  })

  it('relays a pin click whose key is within its limit, and drops one that is not', () => {
    const { up, frameWindow, listeners } = runHostDocument()
    deliver(listeners, frameWindow, {
      type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
      channel: CHANNEL,
      pinKey: 'pin-1'
    })
    deliver(listeners, frameWindow, {
      type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
      channel: CHANNEL,
      pinKey: 'p'.repeat(NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.pinKey + 1)
    })
    expect(up.postMessage).toHaveBeenCalledTimes(1)
    const relayed: unknown = JSON.parse(up.postMessage.mock.calls[0]?.[0] ?? 'null')
    expect(relayed).toEqual({
      kind: 'frame',
      token: TOKEN,
      data: { type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel: CHANNEL, pinKey: 'pin-1' }
    })
  })

  it('drops a report from another window, or from another channel', () => {
    const { up, frameWindow, listeners } = runHostDocument()
    deliver(
      listeners,
      { postMessage: vi.fn() },
      {
        type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
        channel: CHANNEL,
        element: ELEMENT
      }
    )
    deliver(listeners, frameWindow, {
      type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
      channel: 'c'.repeat(32),
      element: ELEMENT
    })
    expect(up.postMessage).not.toHaveBeenCalled()
  })

  it('forwards an annotate command to its frame only when it is on the frame channel', () => {
    const { frameWindow, windowStub } = runHostDocument()
    const command = windowStub[MOBILE_NATIVE_CHAT_VISUAL_ANNOTATE_COMMAND]
    if (typeof command !== 'function') {
      throw new Error('the host document has no annotate command')
    }
    command(JSON.stringify({ type: 'orca-visual-annotate', channel: CHANNEL, enabled: true }))
    command(
      JSON.stringify({ type: 'orca-visual-annotate', channel: 'c'.repeat(32), enabled: true })
    )
    expect(frameWindow.postMessage).toHaveBeenCalledTimes(1)
    expect(frameWindow.postMessage.mock.calls[0]?.[0]).toEqual({
      type: 'orca-visual-annotate',
      channel: CHANNEL,
      enabled: true
    })
  })
})
