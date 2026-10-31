import { describe, expect, it } from 'vitest'
import { NATIVE_CHAT_VISUAL_CSS_VALUE_PATTERN } from './native-chat-visual-annotate'
import type { NativeChatVisualDesignReadout } from './native-chat-visual-annotate'
import type { ComponentSection } from './prototype-design-system-components'
import {
  emptyDesignSystemDraft,
  designSystemDraftGroups,
  draftElementEdits,
  draftElementOf,
  setDraftElementNote,
  setDraftElementValue,
  type DesignSystemDraft
} from './prototype-design-system-draft'
import {
  boundTokenOf,
  colorHexOf,
  DESIGN_ELEMENT_ROOT,
  DESIGN_ELEMENT_ROWS,
  designElementCss,
  elementLocatorOf,
  elementSelectorOf
} from './prototype-design-system-element'
import type { DesignToken } from './prototype-design-system-tokens'

const TOKENS: DesignToken[] = [
  { id: 'color.status-high', group: 'color', name: 'status-high', type: 'color', value: '#dc2626' },
  {
    id: 'color.surface',
    group: 'color',
    name: 'surface',
    type: 'color',
    value: 'rgb(255, 255, 255)'
  },
  { id: 'radius.md', group: 'radius', name: 'md', type: 'dimension', value: '10px' },
  { id: 'type.body', group: 'type', name: 'body', type: 'fontFamily', value: 'Georgia, serif' }
]

const SECTION: ComponentSection = {
  name: 'DecisionButton',
  variants: ['reject'],
  variantOptions: ['reject'],
  bindings: {},
  html: '<button data-id="x"><span>Rechazar</span></button>'
}

const READOUT: NativeChatVisualDesignReadout = {
  kind: 'button',
  fill: '#dc2626',
  color: '#ffffff',
  border: 'transparent',
  borderWidth: 0,
  radius: 10,
  shadow: 'none',
  width: { value: 120, unit: 'px' },
  height: { value: 36, unit: 'px' },
  padding: 12,
  gap: 0,
  fontFamily: 'Georgia, serif',
  fontSize: 15,
  lineHeight: 1.2,
  bold: true,
  italic: false,
  underline: false,
  align: 'left'
}

describe('element locators', () => {
  it('reads the section as the root and a path below it as the element', () => {
    expect(elementLocatorOf('html > body > section:nth-of-type(1)')).toBe(DESIGN_ELEMENT_ROOT)
    expect(elementLocatorOf('html > body > section')).toBe(DESIGN_ELEMENT_ROOT)
    expect(
      elementLocatorOf('html > body > section:nth-of-type(1) > div:nth-of-type(2) > button')
    ).toBe('div:nth-of-type(2) > button')
  })

  it('reads the body path the frame reports, with its nth-of-type index, the same way', () => {
    expect(
      elementLocatorOf(
        'html > body:nth-of-type(1) > section:nth-of-type(1) > div:nth-of-type(1) > button:nth-of-type(1)'
      )
    ).toBe('div:nth-of-type(1) > button:nth-of-type(1)')
    expect(elementLocatorOf('html > body:nth-of-type(1) > section:nth-of-type(1)')).toBe(
      DESIGN_ELEMENT_ROOT
    )
    expect(elementLocatorOf('html > body:nth-of-type(1) > p:nth-of-type(1)')).toBeNull()
  })

  it('keeps an id-anchored path as it is, and refuses a selector outside the section', () => {
    expect(elementLocatorOf('#go > span:nth-of-type(1)')).toBe('#go > span:nth-of-type(1)')
    expect(elementLocatorOf('html > body > p:nth-of-type(1)')).toBeNull()
    expect(elementLocatorOf('html')).toBeNull()
  })

  it('selects the same element back from any locator', () => {
    expect(elementSelectorOf(DESIGN_ELEMENT_ROOT)).toBe('html > body > section:nth-of-type(1)')
    expect(elementSelectorOf('div:nth-of-type(2) > button')).toBe(
      'html > body > section:nth-of-type(1) > div:nth-of-type(2) > button'
    )
    expect(elementSelectorOf('#go')).toBe('#go')
  })
})

describe('element rows', () => {
  it('offers the text-style flags and align only where a kind has text', () => {
    const textRows = DESIGN_ELEMENT_ROWS.text.flatMap((group) => group.rows)
    expect(textRows).toEqual(expect.arrayContaining(['color', 'width', 'lineHeight', 'style']))
    expect(DESIGN_ELEMENT_ROWS.box.flatMap((group) => group.rows)).toContain('gap')
    expect(DESIGN_ELEMENT_ROWS.box.map((group) => group.heading)).not.toContain('Text')
    expect(DESIGN_ELEMENT_ROWS.button.map((group) => group.heading)).toEqual([
      'Color',
      'Shape',
      'Size',
      'Text'
    ])
  })
})

describe('colors and tokens', () => {
  it('reads hex, short hex, rgb and transparent, and nothing else', () => {
    expect(colorHexOf('#ABC')).toBe('#aabbcc')
    expect(colorHexOf('rgb(17, 34, 51)')).toBe('#112233')
    expect(colorHexOf('rgba(17, 34, 51, 1)')).toBe('#112233')
    expect(colorHexOf('transparent')).toBe('transparent')
    expect(colorHexOf('oklch(0.7 0.1 200)')).toBeNull()
  })

  it('binds a row to the token whose value is the original, and to none otherwise', () => {
    expect(boundTokenOf('fill', READOUT, TOKENS)).toBe('color.status-high')
    expect(boundTokenOf('color', READOUT, TOKENS)).toBe('color.surface')
    expect(boundTokenOf('border', READOUT, TOKENS)).toBeNull()
    expect(boundTokenOf('radius', READOUT, TOKENS)).toBe('radius.md')
    expect(boundTokenOf('font', READOUT, TOKENS)).toBe('type.body')
  })

  it('writes a token as its variable and a raw hex or px as itself, and drops what resolves to nothing', () => {
    const css = designElementCss(
      {
        fill: 'color.status-high',
        color: '#ffffff',
        radius: '14px',
        font: 'font.missing',
        borderWidth: 2,
        width: { value: 50, unit: '%' },
        height: { value: 0, unit: 'auto' },
        bold: false,
        align: 'center'
      },
      TOKENS
    )
    expect(css).toEqual({
      'background-color': 'var(--color-status-high)',
      color: '#ffffff',
      'border-radius': '14px',
      'border-width': '2px',
      'border-style': 'solid',
      width: '50%',
      height: 'auto',
      'font-weight': '400',
      'text-align': 'center'
    })
  })

  it('writes only properties and values the frame accepts', () => {
    const css = designElementCss(
      {
        fill: 'color.status-high',
        radius: 'radius.md',
        font: 'type.body',
        padding: 8,
        gap: 4,
        fontSize: 13,
        lineHeight: 1.4,
        italic: true,
        underline: true
      },
      TOKENS
    )
    for (const value of Object.values(css)) {
      expect(NATIVE_CHAT_VISUAL_CSS_VALUE_PATTERN.test(value)).toBe(true)
    }
    expect(css['text-decoration-line']).toBe('underline')
    expect(css['font-style']).toBe('italic')
  })
})

describe('element edits in the draft', () => {
  const placed = (draft: DesignSystemDraft, locator: string, value: string | undefined) =>
    setDraftElementValue(draft, SECTION, locator, 'reject', 'fill', value, undefined)

  it('keys an edit by locator, and a value back at its original removes the edit', () => {
    const edited = setDraftElementValue(
      emptyDesignSystemDraft(),
      SECTION,
      'button:nth-of-type(1)',
      'reject',
      'fill',
      'color.status-audit',
      'color.status-high'
    )
    expect(draftElementEdits(edited, SECTION, 'button:nth-of-type(1)')).toEqual({
      fill: 'color.status-audit'
    })
    const back = setDraftElementValue(
      edited,
      SECTION,
      'button:nth-of-type(1)',
      'reject',
      'fill',
      'color.status-high',
      'color.status-high'
    )
    expect(back.comps).toEqual({})
    expect(draftElementOf(back, SECTION, 'button:nth-of-type(1)')).toBeUndefined()
  })

  it('keeps each element of a component apart, and keeps the variants and bindings beside them', () => {
    const withVariant = {
      ...emptyDesignSystemDraft(),
      comps: { DecisionButton: { variants: ['reject', 'approve'] } }
    }
    const first = placed(withVariant, 'button:nth-of-type(1)', 'color.status-audit')
    const second = placed(first, 'span:nth-of-type(1)', 'color.surface')
    expect(draftElementEdits(second, SECTION, 'button:nth-of-type(1)').fill).toBe(
      'color.status-audit'
    )
    expect(draftElementEdits(second, SECTION, 'span:nth-of-type(1)').fill).toBe('color.surface')
    expect(second.comps.DecisionButton?.variants).toEqual(['reject', 'approve'])
  })

  it('reads an older draft with no elements, and a malformed one, as no edits', () => {
    const older = { ...emptyDesignSystemDraft(), comps: { DecisionButton: { variants: [] } } }
    expect(draftElementEdits(older, SECTION, 'button:nth-of-type(1)')).toEqual({})
    const malformed: DesignSystemDraft = JSON.parse(
      '{"values":{},"comps":{"DecisionButton":{"elements":"broken"}},"notes":{},"removed":{},"added":[]}'
    )
    expect(draftElementEdits(malformed, SECTION, 'button:nth-of-type(1)')).toEqual({})
    expect(() =>
      designSystemDraftGroups({ tokens: TOKENS, components: [SECTION] }, malformed)
    ).not.toThrow()
  })

  it('writes one message item per changed value, the root without its locator', () => {
    const edited = setDraftElementValue(
      emptyDesignSystemDraft(),
      SECTION,
      DESIGN_ELEMENT_ROOT,
      'DecisionButton',
      'gap',
      12,
      0
    )
    const noted = setDraftElementNote(
      edited,
      SECTION,
      'button:nth-of-type(1)',
      'reject',
      'Add a ripple'
    )
    const colored = placed(noted, 'button:nth-of-type(1)', 'color.status-audit')
    const items = designSystemDraftGroups({ tokens: TOKENS, components: [SECTION] }, colored)
      .flatMap((group) => group.items)
      .map((item) => item.text)
    expect(items).toEqual([
      'DecisionButton: gap → 12px',
      'DecisionButton reject (button:nth-of-type(1)): fill → color.status-audit',
      'DecisionButton reject (button:nth-of-type(1)): Add a ripple'
    ])
  })

  it('drops an element with no edit and no note, and a blank note takes the note away', () => {
    const noted = setDraftElementNote(
      emptyDesignSystemDraft(),
      SECTION,
      'span:nth-of-type(1)',
      'Rechazar',
      'Keep the words'
    )
    const cleared = setDraftElementNote(noted, SECTION, 'span:nth-of-type(1)', 'Rechazar', '  ')
    expect(cleared.comps).toEqual({})
  })
})
