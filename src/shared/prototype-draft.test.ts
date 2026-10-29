import { describe, expect, it } from 'vitest'
import {
  buildDraft,
  composeIterationMessage,
  type PrototypeElementState,
  type PrototypePin
} from './prototype-draft'

const base: PrototypeElementState = {
  text: 'Buy now',
  color: '#111111',
  bg: '#ffffff',
  width: { value: 100, unit: '%' },
  height: { value: 48, unit: 'px' },
  fontSize: 14
}

const restyled: PrototypeElementState = {
  text: 'Get started',
  color: '#222222',
  bg: '#000000',
  width: { value: 0, unit: 'auto' },
  height: { value: 40, unit: 'px' },
  fontSize: 12
}

function pin(overrides: Partial<PrototypePin> = {}): PrototypePin {
  return {
    pinKey: 'cta',
    number: 1,
    label: 'Button',
    selector: 'button.cta',
    original: base,
    current: base,
    ...overrides
  }
}

describe('buildDraft', () => {
  it('has no groups when nothing changed', () => {
    expect(buildDraft({ activeLetter: 'A', pins: [pin()], notes: {} })).toEqual({
      groups: [],
      itemCount: 0
    })
  })

  it('lists each changed field of the active direction in order', () => {
    expect(
      buildDraft({ activeLetter: 'A', pins: [pin({ current: restyled })], notes: {} })
    ).toEqual({
      groups: [
        {
          title: 'A · 1 · Button',
          pinKey: 'cta',
          items: [
            {
              field: 'text',
              label: 'text',
              value: '“Buy now” → “Get started”',
              pinKey: 'cta',
              letter: 'A'
            },
            {
              field: 'color',
              label: 'text color',
              value: '#111111 → #222222',
              pinKey: 'cta',
              letter: 'A'
            },
            { field: 'bg', label: 'fill', value: '#ffffff → #000000', pinKey: 'cta', letter: 'A' },
            { field: 'width', label: 'width', value: '100% → auto', pinKey: 'cta', letter: 'A' },
            { field: 'height', label: 'height', value: '48px → 40px', pinKey: 'cta', letter: 'A' },
            {
              field: 'fontSize',
              label: 'font size',
              value: '14px → 12px',
              pinKey: 'cta',
              letter: 'A'
            }
          ]
        }
      ],
      itemCount: 6
    })
  })

  it('removes an item when its field is reverted to the original value', () => {
    const edited = pin({ current: { ...base, text: 'Get started' } })
    expect(buildDraft({ activeLetter: 'A', pins: [edited], notes: {} }).itemCount).toBe(1)
    expect(
      buildDraft({ activeLetter: 'A', pins: [pin({ current: base })], notes: {} }).itemCount
    ).toBe(0)
  })

  it('compares sizes by unit and ignores the number when the unit is auto', () => {
    const fromPixels = pin({
      original: { ...base, width: { value: 48, unit: 'px' } },
      current: { ...base, width: { value: 0, unit: 'auto' } }
    })
    expect(
      buildDraft({ activeLetter: 'A', pins: [fromPixels], notes: {} }).groups[0]?.items
    ).toEqual([
      { field: 'width', label: 'width', value: '48px → auto', pinKey: 'cta', letter: 'A' }
    ])
    const autoToAuto = pin({
      original: { ...base, width: { value: 0, unit: 'auto' } },
      current: { ...base, width: { value: 300, unit: 'auto' } }
    })
    expect(buildDraft({ activeLetter: 'A', pins: [autoToAuto], notes: {} }).itemCount).toBe(0)
  })

  it('adds the trimmed note of the active direction after the field items', () => {
    const draft = buildDraft({
      activeLetter: 'A',
      pins: [pin({ current: { ...base, fontSize: 16 } })],
      notes: { 'A:cta': '  Make it shorter.  ' }
    })
    expect(draft.groups[0]?.items.map((item) => item.field)).toEqual(['fontSize', 'note'])
    expect(draft.groups[0]?.items.at(-1)).toEqual({
      field: 'note',
      label: 'note',
      value: 'Make it shorter.',
      pinKey: 'cta',
      letter: 'A'
    })
  })

  it('ignores a note that is empty after trimming', () => {
    expect(
      buildDraft({ activeLetter: 'A', pins: [pin()], notes: { 'A:cta': '   ' } }).itemCount
    ).toBe(0)
  })

  it('leaves out the notes of every direction but the main', () => {
    expect(
      buildDraft({
        activeLetter: 'A',
        pins: [pin()],
        notes: { 'B:cta': 'Use the bold palette', 'C:footer-link': 'Smaller' }
      })
    ).toEqual({ groups: [], itemCount: 0 })
  })

  it('orders the groups of the main by pin', () => {
    const nav = pin({
      pinKey: 'nav',
      number: 2,
      label: 'Nav',
      selector: 'nav a',
      current: { ...base, fontSize: 16 }
    })
    const draft = buildDraft({
      activeLetter: 'A',
      pins: [pin({ current: { ...base, text: 'Get started' } }), nav],
      notes: { 'C:nav': 'Bigger', 'B:cta': 'Bolder', 'A:nav': 'Tighter' }
    })
    expect(draft.groups.map((group) => group.title)).toEqual(['A · 1 · Button', 'A · 2 · Nav'])
    expect(draft.itemCount).toBe(3)
  })

  it('keeps a note on the active direction whose pin is no longer listed', () => {
    expect(
      buildDraft({ activeLetter: 'A', pins: [pin()], notes: { 'A:footer-link': 'Smaller' } })
    ).toEqual({
      groups: [
        {
          title: 'A · footer-link',
          pinKey: 'footer-link',
          items: [
            { field: 'note', label: 'note', value: 'Smaller', pinKey: 'footer-link', letter: 'A' }
          ]
        }
      ],
      itemCount: 1
    })
  })

  it('lists the orphan notes of the active direction after the pins, by pin key', () => {
    const draft = buildDraft({
      activeLetter: 'A',
      pins: [pin({ current: restyled })],
      notes: { 'B:cta': 'Bold', 'A:zeta': 'Zeta', 'A:alpha': 'Alpha' }
    })
    expect(draft.groups.map((group) => group.title)).toEqual([
      'A · 1 · Button',
      'A · alpha',
      'A · zeta'
    ])
  })

  it('skips a note key that has no letter or no pin key', () => {
    expect(
      buildDraft({
        activeLetter: 'A',
        pins: [pin()],
        notes: { cta: 'No letter', ':cta': 'Empty letter', 'B:': 'No pin' }
      }).itemCount
    ).toBe(0)
  })
})

describe('composeIterationMessage', () => {
  const pins = [pin({ current: restyled })]

  it('composes the header, group lines with selectors, indented items, and the prompt', () => {
    const { groups } = buildDraft({
      activeLetter: 'A',
      pins,
      notes: { 'A:cta': 'Take the bold palette' }
    })
    expect(
      composeIterationMessage({ activeLetter: 'A', groups, pins, prompt: 'Make it bolder.' })
    ).toBe(
      [
        'Iterate on A.',
        'A · 1 · Button (button.cta)',
        '  text: “Buy now” → “Get started”',
        '  text color: #111111 → #222222',
        '  fill: #ffffff → #000000',
        '  width: 100% → auto',
        '  height: 48px → 40px',
        '  font size: 14px → 12px',
        '  note: Take the bold palette',
        '',
        'Make it bolder.'
      ].join('\n')
    )
  })

  it('ends at the last item when the prompt is blank', () => {
    const { groups } = buildDraft({
      activeLetter: 'A',
      pins,
      notes: { 'A:cta': 'Take the bold palette' }
    })
    expect(
      composeIterationMessage({ activeLetter: 'A', groups, pins, prompt: '   ' }).endsWith(
        '\n  note: Take the bold palette'
      )
    ).toBe(true)
  })

  it('is just the header when nothing changed', () => {
    expect(composeIterationMessage({ activeLetter: 'B', groups: [], pins: [], prompt: '' })).toBe(
      'Iterate on B.'
    )
  })

  it('leaves out the parentheses when the pin has no selector', () => {
    expect(
      composeIterationMessage({
        activeLetter: 'A',
        groups: [
          {
            title: 'A · footer-link',
            pinKey: 'footer-link',
            items: [
              {
                field: 'note',
                label: 'note',
                value: 'Smaller',
                pinKey: 'footer-link',
                letter: 'A'
              }
            ]
          }
        ],
        pins: [],
        prompt: ''
      })
    ).toBe('Iterate on A.\nA · footer-link\n  note: Smaller')
  })

  it('keeps each item on one line', () => {
    const draft = buildDraft({
      activeLetter: 'A',
      pins: [pin()],
      notes: { 'A:cta': 'Line one\n  line two' }
    })
    expect(
      composeIterationMessage({
        activeLetter: 'A',
        groups: draft.groups,
        pins: [pin()],
        prompt: ''
      })
    ).toBe('Iterate on A.\nA · 1 · Button (button.cta)\n  note: Line one line two')
  })

  it('adds the screenshot of the pin under its group', () => {
    const { groups } = buildDraft({ activeLetter: 'A', pins, notes: {} })
    const message = composeIterationMessage({
      activeLetter: 'A',
      groups,
      pins,
      prompt: '',
      screenshots: { cta: 'C:/shots/cta.png' }
    })
    expect(message.split('\n').filter((line) => line.includes('screenshot:'))).toEqual([
      '  screenshot: C:/shots/cta.png'
    ])
  })
})

describe('composeIterationMessage with a group that has no items', () => {
  it('gives it no screenshot line, since no item shows it belongs to the iterated direction', () => {
    const message = composeIterationMessage({
      activeLetter: 'A',
      groups: [{ title: 'A · 1 · Button', pinKey: 'pin-1', items: [] }],
      pins: [],
      prompt: '',
      screenshots: { 'pin-1': '/shot.png' }
    })

    expect(message).toBe('Iterate on A.\nA · 1 · Button')
  })
})
