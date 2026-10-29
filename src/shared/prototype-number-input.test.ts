import { describe, expect, it } from 'vitest'
import {
  FONT_SIZE_BOUNDS,
  parseNumberInput,
  SIZE_PERCENT_BOUNDS,
  SIZE_PX_BOUNDS,
  sizeBoundsOf
} from './prototype-number-input'

describe('sizeBoundsOf', () => {
  it('keeps a percentage to 0 to 100, and a px or auto size to 0 to 4000', () => {
    expect(sizeBoundsOf('%')).toBe(SIZE_PERCENT_BOUNDS)
    expect(sizeBoundsOf('px')).toBe(SIZE_PX_BOUNDS)
    expect(sizeBoundsOf('auto')).toBe(SIZE_PX_BOUNDS)
  })
})

describe('parseNumberInput', () => {
  it('pins a typed number into its range', () => {
    expect(parseNumberInput('9999', SIZE_PX_BOUNDS)).toBe(4000)
    expect(parseNumberInput('250', SIZE_PERCENT_BOUNDS)).toBe(100)
    expect(parseNumberInput('-5', SIZE_PX_BOUNDS)).toBe(0)
    expect(parseNumberInput('0', FONT_SIZE_BOUNDS)).toBe(1)
    expect(parseNumberInput('500', FONT_SIZE_BOUNDS)).toBe(200)
  })

  it('keeps a number inside its range as typed', () => {
    expect(parseNumberInput('42', FONT_SIZE_BOUNDS)).toBe(42)
    expect(parseNumberInput(' 12 ', SIZE_PX_BOUNDS)).toBe(12)
  })

  it('gives nothing while the text is not a number yet', () => {
    expect(parseNumberInput('', SIZE_PX_BOUNDS)).toBeNull()
    expect(parseNumberInput('   ', SIZE_PX_BOUNDS)).toBeNull()
    expect(parseNumberInput('-', SIZE_PX_BOUNDS)).toBeNull()
  })
})
