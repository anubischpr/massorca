import { describe, expect, it } from 'vitest'
import { hslToHex, isHexColor, pickerShadeCells } from './prototype-color'

describe('hslToHex', () => {
  it('maps the primary hues at full saturation and mid lightness', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000')
    expect(hslToHex(120, 100, 50)).toBe('#00ff00')
    expect(hslToHex(240, 100, 50)).toBe('#0000ff')
  })

  it('maps zero saturation to greys', () => {
    expect(hslToHex(0, 0, 0)).toBe('#000000')
    expect(hslToHex(200, 0, 100)).toBe('#ffffff')
  })
})

describe('pickerShadeCells', () => {
  it('has 24 cells, each a hex color', () => {
    const cells = pickerShadeCells(210)
    expect(cells).toHaveLength(24)
    expect(cells.every(isHexColor)).toBe(true)
  })
})

describe('isHexColor', () => {
  it('accepts a six-digit hex color only', () => {
    expect(isHexColor('#1a2B3c')).toBe(true)
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('red')).toBe(false)
  })
})
