// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS,
  NATIVE_CHAT_VISUAL_ANNOTATE_TYPE,
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
  NATIVE_CHAT_VISUAL_PINS_TYPE,
  NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
  readNativeChatVisualAnnotateEvent
} from './native-chat-visual-annotate'
import { nativeChatVisualAnnotateScript } from './native-chat-visual-annotate-script'

// The script runs once per file, as it does once per document. Each test starts from a fixture
// body and a reset state, and drives the frame only through messages, as the hosts do.
const CHANNEL = 'd'.repeat(32)
const FIXTURE = `
<main id="app">
  <h1 aria-label="Title">Hello world and more text here</h1>
  <button>Go</button>
  <p class="copy" style="color: rgb(17, 34, 51); background-color: rgb(255, 255, 255); font-size: 18px; width: 120px; height: 40px">Some <b>bold</b> copy</p>
  <div id="empty"></div>
  <div>A Very Long Heading Text That Keeps Going</div>
</main>`

const sent = vi.fn<(message: unknown) => void>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`missing ${what}`)
  }
  return value
}

function htmlChildren(parent: Element): HTMLElement[] {
  return Array.from(parent.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  )
}

function send(
  data: Record<string, unknown>,
  source: MessageEventSource | null = window.parent
): void {
  window.dispatchEvent(new MessageEvent('message', { data: { channel: CHANNEL, ...data }, source }))
}

function sentOfType(type: string): Record<string, unknown>[] {
  return sent.mock.calls
    .map(([message]) => message)
    .filter(isRecord)
    .filter((message) => message.type === type)
}

function click(target: Element): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

function resetState(): void {
  send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: false })
  send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins: [] })
  send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides: [] })
}

function element(selector: string): HTMLElement {
  return required(document.querySelector<HTMLElement>(selector), selector)
}

function overlay(): HTMLElement {
  return required(document.querySelector<HTMLElement>('[data-orca-annotate]'), 'overlay')
}

/** Turns annotate on, clicks the element, and returns the element the frame reported. */
function pick(target: Element): Record<string, unknown> {
  sent.mockClear()
  send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
  click(target)
  const [picked] = sentOfType(NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE)
  if (!picked || !isRecord(picked.element)) {
    throw new Error('no pick reported')
  }
  return picked.element
}

/** The pin badges: overlay children whose text is a number. The hover box is never one. */
function badges(): HTMLElement[] {
  return htmlChildren(overlay()).filter((child) => /^\d+$/.test(child.textContent ?? ''))
}

function badge(number: string): HTMLElement {
  return required(
    badges().find((child) => child.textContent === number),
    `badge ${number}`
  )
}

/** The value the page's own CSS engine gives `value` for `property`, so colors compare normalised. */
function normalised(property: string, value: string): string {
  const probe = document.createElement('i')
  probe.style.setProperty(property, value)
  return probe.style.getPropertyValue(property)
}

beforeAll(() => {
  sent.mockImplementation(() => undefined)
  vi.spyOn(window.parent, 'postMessage').mockImplementation((message: unknown) => {
    sent(message)
  })
  // Runs the same generated source a visual document runs, once for this file.
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

describe('annotate script: when annotate is off', () => {
  it('leaves clicks alone and reports nothing', () => {
    const event = click(element('button'))
    expect(event.defaultPrevented).toBe(false)
    expect(sent).not.toHaveBeenCalled()
  })
})

describe('annotate script: picking', () => {
  it('blocks the click so the link does not navigate and the page handler does not run', () => {
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
    const anchor = document.createElement('a')
    anchor.href = 'https://example.com/x'
    anchor.textContent = 'Link'
    document.body.appendChild(anchor)
    const handler = vi.fn()
    document.body.addEventListener('click', handler)
    const event = click(anchor)
    document.body.removeEventListener('click', handler)
    expect(event.defaultPrevented).toBe(true)
    expect(handler).not.toHaveBeenCalled()
    expect(sentOfType(NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE)).toHaveLength(1)
  })

  it('blocks pointer and mouse presses too, so page handlers do not run', () => {
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
    const handler = vi.fn()
    document.body.addEventListener('mousedown', handler)
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    element('button').dispatchEvent(press)
    document.body.removeEventListener('mousedown', handler)
    expect(press.defaultPrevented).toBe(true)
    expect(handler).not.toHaveBeenCalled()
  })

  it('reports the selector, label, snippet, rect and original state of the element', () => {
    const picked = pick(element('p.copy'))
    expect(picked.selector).toBe('#app > p:nth-of-type(1)')
    expect(picked.label).toBe('some bold copy')
    expect(String(picked.htmlSnippet).startsWith('<p class="copy"')).toBe(true)
    expect(String(picked.htmlSnippet)).toContain('Some <b>bold</b> copy')
    expect(picked.rect).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number)
    })
    expect(picked.state).toEqual({
      text: 'Some  copy',
      color: '#112233',
      bg: '#ffffff',
      width: { value: 120, unit: 'px' },
      height: { value: 40, unit: 'px' },
      fontSize: 18
    })
  })

  it('takes the label from aria-label, then the trimmed text cut at 24 characters, then the tag', () => {
    expect(pick(element('h1')).label).toBe('title')
    expect(pick(element('#empty')).label).toBe('div')
    const long = required(
      Array.from(document.querySelectorAll('div')).find((candidate) =>
        candidate.textContent?.startsWith('A Very')
      ),
      'long heading'
    )
    expect(pick(long).label).toBe('a very long heading text')
  })

  it('caps a tag-name label too, so a long custom element still passes the host check', () => {
    const custom = document.createElement(`x-${'a'.repeat(120)}`)
    document.body.appendChild(custom)
    const picked = pick(custom)
    expect(picked.label).toBe(`x-${'a'.repeat(22)}`)
    expect(
      readNativeChatVisualAnnotateEvent(
        { type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, channel: CHANNEL, element: picked },
        CHANNEL
      )
    ).not.toBeNull()
  })

  it('uses the id when it is unique, and a checked nth-of-type path from html when it is not', () => {
    const duplicate = document.createElement('div')
    duplicate.id = 'empty'
    document.body.appendChild(duplicate)
    const duplicateSelector = String(pick(duplicate).selector)
    expect(duplicateSelector.startsWith('html > body:nth-of-type(1)')).toBe(true)
    expect(document.querySelector(duplicateSelector)).toBe(duplicate)

    expect(pick(element('#app')).selector).toBe('#app')
    const bold = element('b')
    const boldSelector = String(pick(bold).selector)
    expect(boldSelector).toBe('#app > p:nth-of-type(1) > b:nth-of-type(1)')
    expect(document.querySelector(boldSelector)).toBe(bold)
  })

  it('reports the html element as the selector html', () => {
    expect(pick(document.documentElement).selector).toBe('html')
  })

  it('keeps the snippet within its cap', () => {
    document.body.innerHTML = `<div id="big">${'x'.repeat(2000)}</div>`
    const picked = pick(element('#big'))
    expect(String(picked.htmlSnippet).length).toBe(NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.snippet)
  })

  it('keeps the overlay out of the page body, so body selectors and height never see it', () => {
    pick(element('button'))
    expect(overlay().parentNode).toBe(document.documentElement)
  })
})

/** Stubs requestAnimationFrame, so a test runs the frames the script asks for when it says so. */
function withManualFrames(run: (flush: () => void) => void): void {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    frames.push(callback)
    return frames.length
  })
  try {
    run(() => {
      for (const callback of frames.splice(0)) {
        callback(0)
      }
    })
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('annotate script: hover', () => {
  it('shows a 2px blue outline on the element under the pointer, on the next frame', () => {
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
    withManualFrames((flush) => {
      element('button').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
      flush()
    })
    const hover = required(htmlChildren(overlay())[0], 'hover box')
    expect(hover.style.display).toBe('block')
    expect(hover.style.getPropertyValue('outline-width')).toBe('2px')
    expect(hover.style.cssText).toMatch(/outline-color:\s*(#3b82f6|rgb\(59, 130, 246\))/)
  })

  it('does one layout pass for a burst of moves, on the next frame', () => {
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
    const layoutReads = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    try {
      withManualFrames((flush) => {
        for (let i = 0; i < 50; i++) {
          element('button').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
        }
        expect(layoutReads).not.toHaveBeenCalled()
        flush()
      })
      expect(layoutReads).toHaveBeenCalledTimes(1)
    } finally {
      layoutReads.mockRestore()
    }
  })

  it('batches the same way where requestAnimationFrame is absent', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', undefined)
    const layoutReads = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    try {
      send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
      for (let i = 0; i < 50; i++) {
        element('button').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
      }
      expect(layoutReads).not.toHaveBeenCalled()
      vi.advanceTimersByTime(16)
      expect(layoutReads).toHaveBeenCalledTimes(1)
    } finally {
      layoutReads.mockRestore()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })
})

describe('annotate script: touch', () => {
  const TOUCH_TYPES = ['touchstart', 'touchmove', 'touchend']

  function touch(type: string, target: Element): Event {
    const event = new Event(type, { bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return event
  }

  it("keeps the page's touch handlers from running, and leaves the tap's click to pick", () => {
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
    const handler = vi.fn()
    for (const type of TOUCH_TYPES) {
      document.body.addEventListener(type, handler)
    }
    try {
      for (const type of TOUCH_TYPES) {
        expect(touch(type, element('button')).defaultPrevented).toBe(false)
      }
      expect(handler).not.toHaveBeenCalled()
      click(element('button'))
      expect(sentOfType(NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE)).toHaveLength(1)
    } finally {
      for (const type of TOUCH_TYPES) {
        document.body.removeEventListener(type, handler)
      }
    }
  })

  it('leaves touch alone when annotate is off', () => {
    const handler = vi.fn()
    document.body.addEventListener('touchstart', handler)
    try {
      touch('touchstart', element('button'))
      expect(handler).toHaveBeenCalledTimes(1)
    } finally {
      document.body.removeEventListener('touchstart', handler)
    }
  })

  it('lets a tap on a pin badge reach the badge', () => {
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
    send({
      type: NATIVE_CHAT_VISUAL_PINS_TYPE,
      pins: [{ pinKey: 'p1', number: 1, selector: '#app > button:nth-of-type(1)', active: false }]
    })
    sent.mockClear()
    expect(touch('touchend', badge('1')).defaultPrevented).toBe(false)
    click(badge('1'))
    expect(sentOfType(NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE)).toEqual([
      { type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel: CHANNEL, pinKey: 'p1' }
    ])
  })
})

describe('annotate script: pins', () => {
  const pins = [
    { pinKey: 'p1', number: 1, selector: '#app > button:nth-of-type(1)', active: false },
    { pinKey: 'p2', number: 2, selector: '#app > p:nth-of-type(1)', active: true }
  ]

  it('draws a 24px numbered badge per pin, and an outline on the active pin only', () => {
    send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins })
    expect(badges().map((child) => child.textContent)).toEqual(['1', '2'])
    expect(badge('1').style.cssText).toMatch(/width:\s*24px/)
    expect(badge('2').style.cssText).toMatch(/#3b82f6|rgb\(59, 130, 246\)/)
    expect(badge('1').style.cssText).not.toMatch(/#3b82f6|rgb\(59, 130, 246\)/)
    const outlines = htmlChildren(overlay()).filter((child) =>
      /outline-offset:\s*3px/.test(child.style.cssText)
    )
    expect(outlines).toHaveLength(1)
  })

  it('reports a badge click as pin-clicked and never as a pick, in annotate mode too', () => {
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: true })
    send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins })
    sent.mockClear()
    const event = click(badge('1'))
    expect(event.defaultPrevented).toBe(true)
    expect(sentOfType(NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE)).toEqual([
      { type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel: CHANNEL, pinKey: 'p1' }
    ])
    expect(sentOfType(NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE)).toHaveLength(0)
  })

  it('skips a pin whose selector matches nothing, and survives a selector that is not valid CSS', () => {
    expect(() =>
      send({
        type: NATIVE_CHAT_VISUAL_PINS_TYPE,
        pins: [
          { pinKey: 'gone', number: 1, selector: '#missing', active: false },
          { pinKey: 'bad', number: 2, selector: "x'); alert(1); ('", active: false },
          { pinKey: 'ok', number: 3, selector: '#app > h1:nth-of-type(1)', active: false }
        ]
      })
    ).not.toThrow()
    expect(badges().map((child) => child.textContent)).toEqual(['3'])
  })

  it('clears every badge when the pin list is empty', () => {
    send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins })
    send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins: [] })
    expect(badges()).toHaveLength(0)
  })

  it('rejects a list with one invalid pin, and keeps the list it would have replaced', () => {
    const good = { pinKey: 'g', number: 1, selector: '#app > h1:nth-of-type(1)', active: false }
    send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins: [good] })
    const invalid: unknown[] = [
      { ...good, number: 0 },
      { ...good, number: 1.5 },
      { ...good, number: 10000 },
      { ...good, pinKey: '' },
      { ...good, active: 'yes' },
      { ...good, selector: 's'.repeat(NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.selector + 1) }
    ]
    for (const bad of invalid) {
      send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins: [bad] })
      expect(badges().map((child) => child.textContent)).toEqual(['1'])
    }
  })
})

describe('annotate script: overrides', () => {
  const colorOverride = {
    selector: '#app > p:nth-of-type(1)',
    text: 'Changed',
    style: {
      color: '#ff0000',
      backgroundColor: '#00ff00',
      width: { value: 50, unit: '%' },
      height: { value: 0, unit: 'auto' },
      fontSize: 20
    }
  }

  it('applies the text and style live, and restores the original when the set is removed', () => {
    const paragraph = element('p.copy')
    const original = {
      color: paragraph.style.getPropertyValue('color'),
      background: paragraph.style.getPropertyValue('background-color'),
      width: paragraph.style.getPropertyValue('width'),
      fontSize: paragraph.style.getPropertyValue('font-size')
    }

    send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides: [colorOverride] })
    expect(paragraph.style.getPropertyValue('color')).toBe(normalised('color', '#ff0000'))
    expect(paragraph.style.getPropertyValue('background-color')).toBe(
      normalised('background-color', '#00ff00')
    )
    expect(paragraph.style.getPropertyValue('width')).toBe('50%')
    expect(paragraph.style.getPropertyValue('height')).toBe('auto')
    expect(paragraph.style.getPropertyValue('font-size')).toBe('20px')
    expect(paragraph.querySelector('b')?.textContent).toBe('bold')
    expect(paragraph.firstChild?.nodeValue).toBe('Changed')

    send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides: [] })
    expect(paragraph.style.getPropertyValue('color')).toBe(original.color)
    expect(paragraph.style.getPropertyValue('background-color')).toBe(original.background)
    expect(paragraph.style.getPropertyValue('width')).toBe(original.width)
    expect(paragraph.style.getPropertyValue('font-size')).toBe(original.fontSize)
    expect(paragraph.firstChild?.nodeValue).toBe('Some ')
    expect(paragraph.childNodes[2]?.nodeValue).toBe(' copy')
  })

  it('restores the previous set before it applies a replacement', () => {
    const paragraph = element('p.copy')
    const originalColor = paragraph.style.getPropertyValue('color')
    send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides: [colorOverride] })
    send({
      type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
      overrides: [{ selector: 'h1', style: { fontSize: 30 } }]
    })
    expect(paragraph.style.getPropertyValue('color')).toBe(originalColor)
    expect(paragraph.firstChild?.nodeValue).toBe('Some ')
    expect(element('h1').style.getPropertyValue('font-size')).toBe('30px')
  })

  it('adds a text node to an element with no text, and removes it on restore', () => {
    const empty = element('#empty')
    send({
      type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
      overrides: [{ selector: '#empty', text: 'Added' }]
    })
    expect(empty.textContent).toBe('Added')
    send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides: [] })
    expect(empty.childNodes.length).toBe(0)
  })

  it('skips an override whose selector matches nothing', () => {
    expect(() =>
      send({
        type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
        overrides: [{ selector: '#nothing-here', style: { color: '#123456' } }]
      })
    ).not.toThrow()
  })

  it('drops a whole command with one invalid value, and keeps the set it would have replaced', () => {
    const paragraph = element('p.copy')
    send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides: [colorOverride] })
    const applied = paragraph.style.getPropertyValue('color')
    const invalid: unknown[] = [
      [{ selector: '#app', style: { color: 'red' } }],
      [{ selector: '#app', style: { backgroundColor: '#fff' } }],
      [{ selector: '#app', style: { width: { value: 10, unit: 'em' } } }],
      [{ selector: '#app', style: { height: { value: 10000.5e4, unit: 'px' } } }],
      [{ selector: '#app', style: { fontSize: 401 } }],
      [{ selector: '#app', text: 't'.repeat(NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.text + 1) }],
      [{ selector: '' }],
      [{ selector: '#app', style: 'color: red' }],
      [{ selector: '#app' }, 'not an object'],
      Array.from({ length: NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.items + 1 }, () => ({
        selector: '#app'
      }))
    ]
    for (const overrides of invalid) {
      send({ type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, overrides })
      expect(paragraph.style.getPropertyValue('color')).toBe(applied)
    }
  })

  it('treats a selector as data: a hostile string neither throws nor matches anything', () => {
    expect(() =>
      send({
        type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
        overrides: [{ selector: "p'] , alert(1) , [a", text: 'x' }]
      })
    ).not.toThrow()
    expect(element('p.copy').textContent).toBe('Some bold copy')
  })
})

describe('annotate script: messages it must ignore', () => {
  const pin = { pinKey: 'x', number: 1, selector: '#app > h1:nth-of-type(1)', active: false }

  it('ignores a message from another source', () => {
    send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins: [pin] }, null)
    expect(badges()).toHaveLength(0)
  })

  it('ignores a message on another channel', () => {
    send({ type: NATIVE_CHAT_VISUAL_PINS_TYPE, pins: [pin], channel: 'other' })
    expect(badges()).toHaveLength(0)
  })

  it('ignores an unknown kind and a non-boolean enable flag', () => {
    send({ type: 'orca-visual-something', pins: [] })
    send({ type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, enabled: 'yes' })
    const event = click(element('button'))
    expect(event.defaultPrevented).toBe(false)
  })
})
