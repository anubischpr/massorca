import { describe, expect, it } from 'vitest'
import {
  designSystemListSwatches,
  designSystemRequestSwatches,
  summarizeDesignSystem
} from './prototype-design-system-summary'
import { parseDesignTokens, type DesignToken } from './prototype-design-system-tokens'

function color(name: string, value: string): DesignToken {
  return { id: `color.${name}`, group: 'color', name, type: 'color', value }
}

const ALL = [
  color('background', '#fff'),
  color('foreground', '#111'),
  color('primary', '#2563eb'),
  color('muted', '#f5f5f5'),
  color('border', '#e5e5e5'),
  color('success', '#16a34a'),
  color('danger', '#dc2626')
]

describe('swatches', () => {
  it('picks primary, border, muted and success for the list icon', () => {
    expect(designSystemListSwatches(ALL)).toEqual(['#2563eb', '#e5e5e5', '#f5f5f5', '#16a34a'])
  })

  it('picks primary, foreground, muted and success for the request card', () => {
    expect(designSystemRequestSwatches(ALL)).toEqual(['#2563eb', '#111', '#f5f5f5', '#16a34a'])
  })

  it('fills a missing color from the other color tokens, without repeats', () => {
    const tokens = [
      color('background', '#fff'),
      color('primary', '#2563eb'),
      color('danger', '#d00')
    ]
    expect(designSystemListSwatches(tokens)).toEqual(['#2563eb', '#fff', '#d00'])
  })

  it('skips a color value too long for a swatch and takes the next color instead', () => {
    const gradient = `linear-gradient(${Array.from({ length: 8 }, () => '#2563eb').join(', ')})`
    const tokens = [
      color('primary', gradient),
      color('border', '#e5e5e5'),
      color('background', '#fff')
    ]
    expect(designSystemListSwatches(tokens)).toEqual(['#e5e5e5', '#fff'])
  })

  it('ignores tokens that are not colors and gives none for a system without colors', () => {
    const space: DesignToken = {
      id: 'space.1',
      group: 'space',
      name: '1',
      type: 'space',
      value: '4px'
    }
    expect(designSystemListSwatches([space])).toEqual([])
  })

  it('never shows more than four', () => {
    const many = Array.from({ length: 9 }, (_, index) => color(`c${index}`, `#00${index}`))
    expect(designSystemRequestSwatches(many)).toHaveLength(4)
  })
})

describe('summarizeDesignSystem', () => {
  it('reads status, version, count, agent and swatches', () => {
    const parsed = parseDesignTokens(
      JSON.stringify({
        color: { primary: { $value: '#2563eb' }, border: { $value: '#eee' } },
        space: { 1: { $value: '4px' } },
        $extensions: { massorca: { version: 3, status: 'proposed', agent: 'Codex' } }
      })
    )
    expect(parsed && summarizeDesignSystem(parsed)).toEqual({
      status: 'proposed',
      version: 3,
      tokenCount: 3,
      agent: 'Codex',
      swatches: ['#2563eb', '#eee']
    })
  })

  it('reads a missing version as 1 and a missing status as detected', () => {
    const parsed = parseDesignTokens('{}')
    expect(parsed && summarizeDesignSystem(parsed)).toEqual({
      status: 'detected',
      version: 1,
      tokenCount: 0,
      swatches: []
    })
  })
})
