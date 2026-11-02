import { describe, expect, it } from 'vitest'
import { collageColumnsOf, collageRowsOf } from './prototype-design-system-collage'

describe('collageColumnsOf', () => {
  it('spans the columns a card needs at its natural width', () => {
    // A 900 px container: 130 px columns. A 300 px card with its chrome needs ceil(338 / 142) = 3 columns.
    expect(collageColumnsOf(900, 300)).toBe(3)
    expect(collageColumnsOf(900, 40)).toBe(2)
    expect(collageColumnsOf(900, 5000)).toBe(6)
  })

  it('takes full width in a narrow container, and two columns before the width is known', () => {
    expect(collageColumnsOf(400, 300)).toBe(6)
    expect(collageColumnsOf(900, null)).toBe(2)
    expect(collageColumnsOf(900, Number.NaN)).toBe(2)
  })
})

describe('collageRowsOf', () => {
  it('spans the rows a height needs, so the card and its gap fit exactly', () => {
    expect(collageRowsOf(132)).toBe(9)
    expect(collageRowsOf(4)).toBe(1)
    expect(collageRowsOf(null)).toBe(10)
  })
})
