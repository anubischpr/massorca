// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NATIVE_CHAT_VISUAL_ANNOTATE_TYPE,
  NATIVE_CHAT_VISUAL_MEASURE_TYPE,
  NATIVE_CHAT_VISUAL_NATURAL_TYPE,
  readNativeChatVisualNatural,
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
  NATIVE_CHAT_VISUAL_PINS_TYPE,
  readNativeChatVisualAnnotateEvent
} from './native-chat-visual-annotate'
import { nativeChatVisualAnnotateScript } from './native-chat-visual-annotate-script'

// The design readout, trail, css overrides and outline-only pins of the annotate frame. Like the script's
// other tests, the frame runs once per file and is driven only through messages.
const CHANNEL = 'e'.repeat(32)

const FIXTURE = `
<section id="card" style="background-color: rgb(255, 255, 255); padding: 16px; gap: 8px; display: flex; flex-direction: column">
  <button class="go" style="background-color: #112233; color: #ffffff; border-radius: 10px; padding: 12px; font-size: 15px; font-weight: 700">Approve</button>
  <span class="pill" style="background-color: #fee2e2; border: 1px solid #fca5a5; border-radius: 999px; padding: 6px; font-size: 13px">Crítico</span>
  <p class="copy" style="color: rgb(17, 34, 51); font-size: 18px; text-align: center; text-decoration-line: underline; font-style: italic">Plain copy</p>
  <div class="box"><p class="inner">inside</p></div>
</section>`

const sent = vi.fn<(message: unknown) => void>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function send(data: Record<string, unknown>): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { channel: CHANNEL, ...data }, source: window.parent })
  )
}

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector)
  if (found === null) {
    throw new Error(`missing ${selector}`)
  }
  return found
}

function pick(target: Element): Record<string, unknown> {
  sent.mockClear()
  send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  const picked = sent.mock.calls
    .map(([message]) => message)
    .filter(isRecord)
    .find((message) => message.type === NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE)
  if (!isRecord(picked) || !isRecord(picked.element)) {
    throw new Error('no pick reported')
  }
  return picked.element
}

/** The value the page's own CSS engine gives `value` for `property`, so colors compare normalised. */
function normalised(property: string, value: string): string {
  const probe = document.createElement('i')
  probe.style.setProperty(property, value)
  return probe.style.getPropertyValue(property)
}

function resetState(): void {
  send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: false })
  send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins: [] })
  send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides: [] })
}

beforeAll(() => {
  sent.mockImplementation(() => undefined)
  vi.spyOn(window.parent, 'postMessage').mockImplementation((message: unknown) => {
    sent(message)
  })
  new Function(nativeChatVisualAnnotateScript(CHANNEL))()
})

afterAll(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  document.body.innerHTML = FIXTURE
  resetState()
  sent.mockClear()
})

describe('annotate script: design readout', () => {
  it('reads a painted, interactive element as a button with its own values', () => {
    const picked = pick(element('button.go'))
    const design = picked.design
    expect(design).toMatchObject({
      kind: 'button',
      fill: '#112233',
      color: '#ffffff',
      border: 'transparent',
      borderWidth: 0,
      radius: 10,
      padding: 12,
      fontSize: 15,
      bold: true,
      italic: false,
      underline: false,
      align: 'left'
    })
  })

  it('reads a pill with a border as a badge, and a bare text as a text', () => {
    expect(fieldOf(pick(element('span.pill')).design, 'kind')).toBe('badge')
    const copy = pick(element('p.copy')).design
    expect(copy).toMatchObject({
      kind: 'text',
      color: '#112233',
      fill: '#ffffff',
      underline: true,
      italic: true,
      align: 'center',
      fontSize: 18
    })
  })

  it('reads a container that holds blocks as a box', () => {
    expect(fieldOf(pick(element('div.box')).design, 'kind')).toBe('box')
  })

  it('reads the file value while the frame applies an override to the same element', () => {
    send({
      type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
      overrides: [{ selector: 'button.go', style: { css: { 'background-color': '#ff0000' } } }]
    })
    const picked = pick(element('button.go'))
    expect(fieldOf(picked.design, 'fill')).toBe('#112233')
    expect(element('button.go').style.getPropertyValue('background-color')).toBe(
      normalised('background-color', '#ff0000')
    )
  })

  it('reports the ancestors outermost first, each with its own readout', () => {
    const picked = pick(element('p.inner'))
    const trail = listOf(picked.trail)
    expect(trail).toHaveLength(2)
    expect(fieldOf(trail[0], 'selector')).toBe('#card')
    expect(fieldOf(trail[0], 'design')).toMatchObject({ padding: 16 })
    expect(fieldOf(trail[1], 'label')).toBe('inside')
    expect(fieldOf(trail[1], 'design')).toMatchObject({ kind: 'box' })
  })

  it('accepts a pick with a design and a trail through the host reader', () => {
    const picked = pick(element('button.go'))
    const event = readNativeChatVisualAnnotateEvent(
      { type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, channel: CHANNEL, element: picked },
      CHANNEL
    )
    expect(event?.kind).toBe('element-picked')
  })
})

describe('annotate script: css overrides', () => {
  it('applies every allowlisted declaration, including a token variable', () => {
    send({
      type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
      overrides: [
        {
          selector: 'button.go',
          style: {
            css: {
              'background-color': 'var(--color-status-low)',
              'border-radius': '14px',
              'font-weight': '400',
              'text-align': 'left'
            }
          }
        }
      ]
    })
    const go = element('button.go')
    expect(go.style.getPropertyValue('background-color')).toBe('var(--color-status-low)')
    expect(go.style.getPropertyValue('border-radius')).toBe('14px')
    expect(go.style.getPropertyValue('font-weight')).toBe('400')
    expect(go.style.getPropertyValue('text-align')).toBe('left')
  })

  it('drops the whole command for a property outside the allowlist', () => {
    send({
      type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
      overrides: [{ selector: 'button.go', style: { css: { 'background-image': 'url(x)' } } }]
    })
    expect(element('button.go').style.getPropertyValue('background-image')).toBe('')
  })

  it('drops the whole command for a value outside the value shape', () => {
    send({
      type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
      overrides: [{ selector: 'button.go', style: { css: { color: 'red; background: url(x)' } } }]
    })
    expect(element('button.go').style.getPropertyValue('color')).toBe('#ffffff')
    expect(element('button.go').style.getPropertyValue('background-color')).toBe('#112233')
  })
})

describe('annotate script: outline-only pins', () => {
  it('draws the outline of an active pin with no badge when badge is false', () => {
    send({
      type: NATIVE_CHAT_VISUAL_PINS_TYPE,
      pins: [{ pinKey: 'k', number: 1, selector: 'p.copy', active: true, badge: false }]
    })
    const overlay = element('[data-orca-annotate]')
    const badges = Array.from(overlay.children).filter((child) =>
      /^\d+$/.test(child.textContent ?? '')
    )
    expect(badges).toHaveLength(0)
    expect(overlay.children.length).toBeGreaterThan(0)
  })

  it('rejects a pin whose badge is not a boolean, and keeps the list it would replace', () => {
    send({
      type: NATIVE_CHAT_VISUAL_PINS_TYPE,
      pins: [{ pinKey: 'k', number: 7, selector: 'p.copy', active: false }]
    })
    send({
      type: NATIVE_CHAT_VISUAL_PINS_TYPE,
      pins: [{ pinKey: 'k', number: 1, selector: 'p.copy', active: false, badge: 'no' }]
    })
    const badges = Array.from(element('[data-orca-annotate]').children).map(
      (child) => child.textContent
    )
    expect(badges).toContain('7')
    expect(badges).not.toContain('1')
  })
})

describe('annotate script: natural width', () => {
  it('answers a measure request with the body width at max-content and the section readout', () => {
    sent.mockClear()
    send({ type: NATIVE_CHAT_VISUAL_MEASURE_TYPE })
    const answer = sent.mock.calls
      .map(([message]) => message)
      .filter(isRecord)
      .find((message) => message.type === NATIVE_CHAT_VISUAL_NATURAL_TYPE)
    expect(answer).toMatchObject({ channel: CHANNEL, width: expect.any(Number) })
    expect(
      answer === undefined ? null : readNativeChatVisualNatural(answer, CHANNEL)?.root
    ).toMatchObject({
      gap: 0,
      padding: 16
    })
  })

  it('reads only a width in range, and drops a message on another channel', () => {
    expect(
      readNativeChatVisualNatural(
        { type: NATIVE_CHAT_VISUAL_NATURAL_TYPE, channel: CHANNEL, width: -1 },
        CHANNEL
      )
    ).toBeNull()
    expect(
      readNativeChatVisualNatural(
        { type: NATIVE_CHAT_VISUAL_NATURAL_TYPE, channel: CHANNEL, width: 320 },
        CHANNEL
      )
    ).toEqual({ width: 320 })
    expect(
      readNativeChatVisualNatural(
        { type: NATIVE_CHAT_VISUAL_NATURAL_TYPE, channel: 'other', width: 320 },
        CHANNEL
      )
    ).toBeNull()
  })
})
