import { describe, expect, it } from 'vitest'
import {
  NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS,
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
  nativeChatVisualAnnotateMessages,
  readNativeChatVisualAnnotateEvent,
  type NativeChatVisualAnnotateState
} from './native-chat-visual-annotate'

const CHANNEL = 'c'.repeat(32)

const state = {
  color: '#000000',
  bg: '#ffffff',
  text: 'Go',
  width: { value: 120, unit: 'px' },
  height: { value: 40, unit: 'px' },
  fontSize: 14
}

const element = {
  selector: '#app > button:nth-of-type(1)',
  label: 'go',
  rect: { x: 10, y: 20, width: 120, height: 40 },
  htmlSnippet: '<button>Go</button>',
  state: { ...state, color: '#000000' }
}

/** A picked-element message on CHANNEL, with `patch` merged into the element. */
function picked(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
    channel: CHANNEL,
    element: { ...element, ...patch }
  }
}

describe('readNativeChatVisualAnnotateEvent', () => {
  it('accepts a picked element and a pin click on its own channel', () => {
    expect(readNativeChatVisualAnnotateEvent(picked(), CHANNEL)).toEqual({
      kind: 'element-picked',
      element: {
        selector: '#app > button:nth-of-type(1)',
        label: 'go',
        rect: { x: 10, y: 20, width: 120, height: 40 },
        htmlSnippet: '<button>Go</button>',
        state: {
          text: 'Go',
          color: '#000000',
          bg: '#ffffff',
          width: { value: 120, unit: 'px' },
          height: { value: 40, unit: 'px' },
          fontSize: 14
        }
      }
    })
    expect(
      readNativeChatVisualAnnotateEvent(
        { type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel: CHANNEL, pinKey: 'pin-1' },
        CHANNEL
      )
    ).toEqual({ kind: 'pin-clicked', pinKey: 'pin-1' })
  })

  it('drops a message from another channel or without one', () => {
    expect(readNativeChatVisualAnnotateEvent(picked(), 'other')).toBeNull()
    const { channel: _channel, ...unchannelled } = picked()
    expect(readNativeChatVisualAnnotateEvent(unchannelled, CHANNEL)).toBeNull()
  })

  it('ignores unknown kinds and non-objects', () => {
    expect(
      readNativeChatVisualAnnotateEvent({ type: 'orca-visual-other', channel: CHANNEL }, CHANNEL)
    ).toBeNull()
    expect(readNativeChatVisualAnnotateEvent('picked', CHANNEL)).toBeNull()
    expect(readNativeChatVisualAnnotateEvent(null, CHANNEL)).toBeNull()
  })

  it('drops a pin click whose key is empty, missing or over the cap', () => {
    const click = (pinKey: unknown) =>
      readNativeChatVisualAnnotateEvent(
        { type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel: CHANNEL, pinKey },
        CHANNEL
      )
    expect(click('')).toBeNull()
    expect(click(undefined)).toBeNull()
    expect(click(7)).toBeNull()
    expect(click('k'.repeat(NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.pinKey + 1))).toBeNull()
  })

  it('drops a picked element with a missing, empty or oversized string field', () => {
    const cap = NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS
    expect(readNativeChatVisualAnnotateEvent(picked({ selector: '' }), CHANNEL)).toBeNull()
    expect(
      readNativeChatVisualAnnotateEvent(picked({ selector: 's'.repeat(cap.selector + 1) }), CHANNEL)
    ).toBeNull()
    expect(
      readNativeChatVisualAnnotateEvent(picked({ label: 'l'.repeat(cap.label + 1) }), CHANNEL)
    ).toBeNull()
    expect(
      readNativeChatVisualAnnotateEvent(
        picked({ htmlSnippet: 'h'.repeat(cap.snippet + 1) }),
        CHANNEL
      )
    ).toBeNull()
    expect(readNativeChatVisualAnnotateEvent(picked({ label: undefined }), CHANNEL)).toBeNull()
  })

  it('drops a rect with a non-finite number or a negative size', () => {
    for (const rect of [
      { x: Number.NaN, y: 0, width: 1, height: 1 },
      { x: 0, y: Number.POSITIVE_INFINITY, width: 1, height: 1 },
      { x: 0, y: 0, width: -1, height: 1 },
      { x: 0, y: 0, width: 1, height: '1' },
      null
    ]) {
      expect(readNativeChatVisualAnnotateEvent(picked({ rect }), CHANNEL), String(rect)).toBeNull()
    }
  })

  it('drops a state with a color that is not #rrggbb or a size with a bad unit or value', () => {
    const withState = (patch: Record<string, unknown>) =>
      readNativeChatVisualAnnotateEvent(picked({ state: { ...state, ...patch } }), CHANNEL)
    expect(withState({ color: 'red' })).toBeNull()
    expect(withState({ bg: '#fff' })).toBeNull()
    expect(withState({ color: 'rgb(0, 0, 0)' })).toBeNull()
    expect(withState({ width: { value: 10, unit: 'em' } })).toBeNull()
    expect(withState({ height: { value: -1, unit: 'px' } })).toBeNull()
    expect(withState({ width: { value: 10001, unit: 'px' } })).toBeNull()
    expect(withState({ width: { value: Number.NaN, unit: 'auto' } })).toBeNull()
    expect(withState({ fontSize: 401 })).toBeNull()
    expect(withState({ fontSize: -1 })).toBeNull()
    expect(withState({ text: 't'.repeat(NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.text + 1) })).toBeNull()
  })

  it('keeps a percent or auto size', () => {
    const result = readNativeChatVisualAnnotateEvent(
      picked({
        state: { ...state, width: { value: 50, unit: '%' }, height: { value: 0, unit: 'auto' } }
      }),
      CHANNEL
    )
    expect(result?.kind === 'element-picked' && result.element.state.width).toEqual({
      value: 50,
      unit: '%'
    })
    expect(result?.kind === 'element-picked' && result.element.state.height).toEqual({
      value: 0,
      unit: 'auto'
    })
  })
})

describe('nativeChatVisualAnnotateMessages', () => {
  it('turns the annotate state into the three host messages on one channel', () => {
    const annotate: NativeChatVisualAnnotateState = {
      enabled: true,
      pins: [{ pinKey: 'p1', number: 1, selector: '#app', active: true }],
      overrides: [{ selector: '#app', text: 'Hi' }]
    }
    expect(nativeChatVisualAnnotateMessages(annotate, CHANNEL)).toEqual([
      { type: 'orca-visual-annotate', channel: CHANNEL, enabled: true },
      { type: 'orca-visual-pins', channel: CHANNEL, pins: annotate.pins },
      { type: 'orca-visual-overrides', channel: CHANNEL, overrides: annotate.overrides }
    ])
  })
})
