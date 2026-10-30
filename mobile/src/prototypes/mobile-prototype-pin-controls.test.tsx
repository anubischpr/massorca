import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { NativeChatVisualPickedElement } from '../../../src/shared/native-chat-visual-annotate'
import {
  createSetState,
  editSelected,
  openDirection,
  pickElement,
  selectedPinOf,
  setPrompt,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import { draftOf } from '../../../src/shared/prototype-set-view'
import { MobilePrototypeDraftSheet } from './MobilePrototypeDraftSheet'
import { MobilePrototypePinSheet } from './MobilePrototypePinSheet'
import { MobilePrototypeSizeRow } from './MobilePrototypeSizeRow'
import { MobilePrototypeReadOnlyBanner } from './MobilePrototypeReadOnlyBanner'
import { MobilePrototypeReadOnlySheet } from './MobilePrototypeReadOnlySheet'
import { NOTE_LABEL } from './mobile-prototype-viewer-model'

vi.mock('react-native', () => ({
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false) },
  Animated: {
    Value: class {
      setValue(): void {}
      interpolate(): number {
        return 0
      }
    }
  },
  Easing: { out: () => () => 0, quad: () => 0 },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles, absoluteFillObject: {} },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 800, scale: 1, fontScale: 1 })
}))

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  ClipPath: 'ClipPath',
  Defs: 'Defs',
  Path: 'Path',
  Rect: 'Rect'
}))

const HEADING: NativeChatVisualPickedElement = {
  selector: 'main > h1',
  label: 'heading',
  rect: { x: 0, y: 0, width: 100, height: 24 },
  htmlSnippet: '<h1>Checkout</h1>',
  state: {
    text: 'Checkout',
    color: '#171717',
    bg: '#ffffff',
    width: { value: 100, unit: '%' },
    height: { value: 0, unit: 'auto' },
    fontSize: 20
  }
}

/** A pin on the direction B, shown read-only while A is the main. */
function readOnlyB(): PrototypeSetState {
  return pickElement(openDirection(createSetState(['A', 'B']), 'B'), HEADING)
}

function flatText(node: ReactTestInstance): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : flatText(child)))
    .join('')
}

/** The host elements of one type; the test doubles for Text and the like are host strings. */
function hosts(root: ReactTestInstance, type: string): ReactTestInstance[] {
  return root.findAll((node) => node.type === type)
}

function mountPinSheet(state: PrototypeSetState, onTab: (tab: 'edit' | 'note') => void) {
  const pin = selectedPinOf(state)
  if (pin === null) {
    throw new Error('the state has no selected pin')
  }
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(
      createElement(MobilePrototypePinSheet, {
        pin,
        state,
        update: () => {},
        tab: 'edit',
        onTab,
        pulseField: null,
        pulseNonce: 0
      })
    )
  })
  if (renderer === undefined) {
    throw new Error('the pin sheet did not mount')
  }
  return renderer
}

/** The draft sheet on screen, with its Send naming the Codex agent. */
function mountDraftSheet(state: PrototypeSetState): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(
      createElement(MobilePrototypeDraftSheet, {
        agentName: 'Codex',
        state,
        update: () => {},
        onClose: () => {},
        onJump: () => {},
        onSend: () => {}
      })
    )
  })
  if (renderer === undefined) {
    throw new Error('the draft sheet did not mount')
  }
  return renderer
}

/** The Send button of a mounted draft sheet, found by its label. */
function sendButton(renderer: ReactTestRenderer): ReactTestInstance {
  const button = renderer.root
    .findAllByProps({ accessibilityRole: 'button' })
    .find((node) => hosts(node, 'Text').some((text) => text.props.children === 'Send to Codex'))
  if (button === undefined) {
    throw new Error('the draft sheet has no Send button')
  }
  return button
}

describe('the pin sheet of the main', () => {
  it('offers the Edit and Note tabs, both pressable', () => {
    const state = pickElement(createSetState(['A', 'B']), HEADING)
    const renderer = mountPinSheet(state, vi.fn())

    const tabs = renderer.root.findAllByProps({ accessibilityRole: 'tab' })
    expect(tabs.map((tab) => tab.props.accessibilityState)).toEqual([
      { selected: true },
      { selected: false }
    ])
    expect(tabs.map((tab) => tab.props.disabled)).toEqual([undefined, undefined])
  })
})

describe('the properties sheet of a read-only direction', () => {
  function mountReadOnlySheet(update: () => void = () => {}, fill?: string): ReactTestRenderer {
    const state = readOnlyB()
    const selected = selectedPinOf(state)
    if (selected === null) {
      throw new Error('the state has no selected pin')
    }
    const pin =
      fill === undefined ? selected : { ...selected, current: { ...selected.current, bg: fill } }
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(createElement(MobilePrototypeReadOnlySheet, { pin, state, update }))
    })
    if (renderer === undefined) {
      throw new Error('the read-only sheet did not mount')
    }
    return renderer
  }

  it('titles the element, shows its selector and the read-only heading, and has no tabs or note', () => {
    const { root } = mountReadOnlySheet()
    const texts = hosts(root, 'Text').map((text) => text.props.children)

    expect(texts).toContain('B · 1 · heading')
    expect(texts).toContain('main > h1')
    expect(texts).toContain('Properties · read-only')
    expect(root.findAllByProps({ accessibilityRole: 'tab' })).toHaveLength(0)
    expect(root.findAllByProps({ accessibilityLabel: NOTE_LABEL })).toHaveLength(0)
    expect(texts).not.toContain('Note')
  })

  it('shows Text as a disabled field and the colors and size as they are', () => {
    const { root } = mountReadOnlySheet()
    const [input] = root.findAllByProps({ accessibilityLabel: 'Text' })
    expect(input?.props.editable).toBe(false)
    expect(input?.props.value).toBe('Checkout')

    const texts = hosts(root, 'Text').map((text) => text.props.children)
    expect(texts).toEqual(expect.arrayContaining(['Text color', '#171717', 'Fill', '#ffffff']))
    expect(texts).toContain('Size')
    expect(texts).toContain('100% × auto · 20px')
  })

  it('leaves the Fill row out when no ancestor paints, rather than showing a value that is not there', () => {
    const { root } = mountReadOnlySheet(() => {}, 'transparent')
    const texts = hosts(root, 'Text').map((text) => text.props.children)
    expect(texts).toContain('Text color')
    expect(texts).not.toContain('Fill')
    expect(texts).not.toContain('transparent')
  })

  it('closes the selection from the × button', () => {
    const update = vi.fn()
    const { root } = mountReadOnlySheet(update)
    act(() => {
      root.findByProps({ accessibilityLabel: 'Close' }).props.onPress()
    })
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe('the read-only banner', () => {
  it('names the direction and the main, and has Back to main and Make main', () => {
    const onBackToMain = vi.fn()
    const onMakeMain = vi.fn()
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        createElement(MobilePrototypeReadOnlyBanner, {
          view: 'C',
          main: 'B',
          onBackToMain,
          onMakeMain
        })
      )
    })
    const root = renderer?.root
    if (root === undefined) {
      throw new Error('the banner did not mount')
    }
    const [sentence] = hosts(root, 'Text')
    expect(sentence === undefined ? '' : flatText(sentence)).toBe(
      'Viewing C, read-only. Tap any element to see its properties; notes and edits go on the main, B.'
    )
    const labels = hosts(root, 'Text').map((text) => text.props.children)
    expect(labels).toEqual(expect.arrayContaining(['Back to main', 'Make main']))

    const buttons = root.findAllByProps({ accessibilityRole: 'button' })
    act(() => {
      buttons[0]?.props.onPress()
      buttons[1]?.props.onPress()
    })
    expect(onBackToMain).toHaveBeenCalledTimes(1)
    expect(onMakeMain).toHaveBeenCalledTimes(1)
    expect(buttons).toHaveLength(2)
  })
})

describe('the Edit tab of a button pin', () => {
  it('shows the Text color and Fill rows, as for any element', () => {
    const button = {
      ...HEADING,
      selector: 'button.cta',
      label: 'pay button',
      htmlSnippet: '<button>Pay now</button>'
    }
    const renderer = mountPinSheet(pickElement(createSetState(['A']), button), vi.fn())
    expect(renderer.root.findAllByProps({ label: 'Text color' }).length).toBeGreaterThan(0)
    expect(renderer.root.findAllByProps({ label: 'Fill' }).length).toBeGreaterThan(0)
  })
})

describe('the Width and Height number inputs', () => {
  it('pins a typed px value into its range', () => {
    const onChange = vi.fn()
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        createElement(MobilePrototypeSizeRow, {
          label: 'Width',
          size: { value: 100, unit: 'px' },
          onChange
        })
      )
    })
    const input = renderer?.root.findByProps({ accessibilityLabel: 'Width value' })
    act(() => {
      input?.props.onChangeText('99999')
    })
    expect(onChange).toHaveBeenLastCalledWith({ value: 4000, unit: 'px' })
  })

  it('pins a value into the range of a percentage when its unit is chosen', () => {
    const onChange = vi.fn()
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        createElement(MobilePrototypeSizeRow, {
          label: 'Height',
          size: { value: 300, unit: 'px' },
          onChange
        })
      )
    })
    const percent =
      renderer && hosts(renderer.root, 'Text').find((text) => text.props.children === '%')
    act(() => {
      percent?.parent?.props.onPress()
    })
    expect(onChange).toHaveBeenLastCalledWith({ value: 100, unit: '%' })
  })
})

describe('the draft sheet', () => {
  const draftState = (overrides: Partial<PrototypeSetState>): PrototypeSetState => ({
    ...createSetState(['A', 'B']),
    ...overrides
  })

  it('says a send was refused only after a refused send, and holds Send while one is in flight', () => {
    const refused = mountDraftSheet(draftState({ sendFailed: true }))
    expect(refused.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1)

    const idle = mountDraftSheet(draftState({ sendFailed: false }))
    expect(idle.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0)

    // Words are in the draft, so the only reason Send is held is the send in flight.
    const busy = mountDraftSheet(setPrompt(draftState({ sending: true }), 'Make it bolder.'))
    expect(sendButton(busy).props.disabled).toBe(true)
  })

  it('holds Send while the draft has no change and "Anything else" has no words', () => {
    const empty = createSetState(['A', 'B'])
    const changed = editSelected(pickElement(empty, HEADING), { text: 'Checkout now' })
    expect(draftOf(changed).itemCount).toBeGreaterThan(0)

    expect(sendButton(mountDraftSheet(empty)).props.disabled).toBe(true)
    expect(sendButton(mountDraftSheet(setPrompt(empty, '   '))).props.disabled).toBe(true)
    expect(sendButton(mountDraftSheet(setPrompt(empty, 'Make it bolder.'))).props.disabled).toBe(
      false
    )
    expect(sendButton(mountDraftSheet(changed)).props.disabled).toBe(false)
  })
})
