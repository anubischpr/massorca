import { describe, expect, it } from 'vitest'
import { NATIVE_CHAT_VISUAL_SIZE_TYPE } from '../../../src/shared/native-chat-visual-shell'
import {
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
  type NativeChatVisualAnnotateState
} from '../../../src/shared/native-chat-visual-annotate'
import { readMobileNativeChatVisualBridgeMessage } from './mobile-native-chat-visual-bridge'
import { buildMobileNativeChatVisualHostDocument } from './mobile-native-chat-visual-host-document'
import { mobileNativeChatVisualAnnotateInjection } from './mobile-native-chat-visual-annotate-injection'

const TOKEN = 'f'.repeat(32)
const CHANNEL = 'c'.repeat(32)

function frame(data: Record<string, unknown>, token: string = TOKEN): string {
  return JSON.stringify({ token, kind: 'frame', data: { channel: CHANNEL, ...data } })
}

const element = {
  selector: '#app > button:nth-of-type(1)',
  label: 'go',
  rect: { x: 1, y: 2, width: 3, height: 4 },
  htmlSnippet: '<button>Go</button>',
  state: {
    text: 'Go',
    color: '#000000',
    bg: '#ffffff',
    width: { value: 3, unit: 'px' },
    height: { value: 4, unit: 'px' },
    fontSize: 14
  }
}

describe('readMobileNativeChatVisualBridgeMessage annotate events', () => {
  it('accepts a picked element and a pin click relayed with the frame token', () => {
    expect(
      readMobileNativeChatVisualBridgeMessage(
        frame({ type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, element }),
        TOKEN,
        CHANNEL,
        true
      )
    ).toEqual({
      kind: 'element-picked',
      element: {
        selector: element.selector,
        label: element.label,
        rect: element.rect,
        htmlSnippet: element.htmlSnippet,
        state: element.state
      }
    })
    expect(
      readMobileNativeChatVisualBridgeMessage(
        frame({ type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, pinKey: 'p1' }),
        TOKEN,
        CHANNEL,
        true
      )
    ).toEqual({ kind: 'pin-clicked', pinKey: 'p1' })
  })

  it('drops picks and pin clicks from a visual built without the annotate script', () => {
    const picked = { type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, element }
    expect(readMobileNativeChatVisualBridgeMessage(frame(picked), TOKEN, CHANNEL, false)).toBeNull()
    expect(
      readMobileNativeChatVisualBridgeMessage(
        frame({ type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, pinKey: 'p1' }),
        TOKEN,
        CHANNEL,
        false
      )
    ).toBeNull()
  })

  it('drops an annotate event without the frame token, or with a malformed element', () => {
    const picked = { type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, element }
    expect(
      readMobileNativeChatVisualBridgeMessage(frame(picked, 'other'), TOKEN, CHANNEL, true)
    ).toBeNull()
    expect(
      readMobileNativeChatVisualBridgeMessage(
        frame({
          type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
          element: { ...element, rect: null }
        }),
        TOKEN,
        CHANNEL,
        true
      )
    ).toBeNull()
    expect(
      readMobileNativeChatVisualBridgeMessage(
        frame({ type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, pinKey: 42 }),
        TOKEN,
        CHANNEL,
        true
      )
    ).toBeNull()
  })

  it('still reads the size report the same way', () => {
    expect(
      readMobileNativeChatVisualBridgeMessage(
        frame({ type: NATIVE_CHAT_VISUAL_SIZE_TYPE, height: 200 }),
        TOKEN,
        CHANNEL,
        true
      )
    ).toEqual({ kind: 'size', height: 200 })
  })
})

describe('buildMobileNativeChatVisualHostDocument annotate forwarding', () => {
  const build = (annotate?: boolean) =>
    buildMobileNativeChatVisualHostDocument({
      visualDocument: '<p>hi</p>',
      channel: CHANNEL,
      token: TOKEN,
      title: 'Visual',
      mode: 'fullscreen',
      ...(annotate === undefined ? {} : { annotate })
    })

  it('carries no annotate code unless the visual is annotate-capable', () => {
    const plain = build()
    expect(plain).not.toContain('__orcaVisualAnnotate')
    expect(plain).not.toContain(NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE)
    expect(build(false)).toBe(plain)
  })

  it('forwards annotate commands to the frame, and relays only the annotate reports', () => {
    const capable = build(true)
    expect(capable).toContain('window[C.annotateCommand] = function (text)')
    expect(capable).toContain('message.channel !== C.channel')
    expect(capable).toContain(`"picked":"${NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE}"`)
    expect(capable).toContain(`"pinClicked":"${NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE}"`)
  })
})

describe('mobileNativeChatVisualAnnotateInjection', () => {
  const state: NativeChatVisualAnnotateState = {
    enabled: true,
    pins: [{ pinKey: 'p1', number: 1, selector: '#app', active: false }],
    overrides: [{ selector: '#app', text: 'It\u2028s "quoted" </script>' }]
  }

  it('sends the three messages as JSON string literals, so the host string is data and not code', () => {
    const script = mobileNativeChatVisualAnnotateInjection(state, CHANNEL)
    expect(script.endsWith(' true;')).toBe(true)
    // Each call's argument is one JSON string literal: decode it once for the string, once for the message.
    const literals = Array.from(
      script.matchAll(/window\.__orcaVisualAnnotate\(("(?:[^"\\]|\\.)*")\);/g),
      (match) => JSON.parse(JSON.parse(match[1] ?? '""'))
    )
    expect(literals).toEqual([
      { type: 'orca-visual-annotate', channel: CHANNEL, enabled: true },
      { type: 'orca-visual-pins', channel: CHANNEL, pins: state.pins },
      { type: 'orca-visual-overrides', channel: CHANNEL, overrides: state.overrides }
    ])
    expect(script).not.toContain('\u2028')
  })
})
