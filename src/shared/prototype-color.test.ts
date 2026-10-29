import { describe, expect, it } from 'vitest'
import { hslToHex, isHexColor, pickerHueOf, pickerShadeCells } from './prototype-color'

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

describe('pickerHueOf', () => {
  it('opens on the picker hue nearest the color’s own hue', () => {
    expect(pickerHueOf('#ff0000')).toBe(0)
    expect(pickerHueOf('#00ff00')).toBe(120)
    expect(pickerHueOf('#0000ff')).toBe(240)
    expect(pickerHueOf('#ff8000')).toBe(30)
    expect(pickerHueOf('#ff00aa')).toBe(330)
  })

  it('opens on hue 0 for a gray or a value that is not hex', () => {
    expect(pickerHueOf('#808080')).toBe(0)
    expect(pickerHueOf('var(--primary)')).toBe(0)
  })
})
