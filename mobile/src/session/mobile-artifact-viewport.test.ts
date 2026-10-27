import { describe, expect, it } from 'vitest'
import { isSpanNearViewport } from './mobile-artifact-viewport'

const VIEWPORT = { top: 100, bottom: 800 }

describe('isSpanNearViewport', () => {
  it('counts a tile inside the list', () => {
    expect(isSpanNearViewport({ top: 300, bottom: 410 }, VIEWPORT)).toBe(true)
  })

  it('counts a tile just past the edge, within the preload margin', () => {
    expect(isSpanNearViewport({ top: 900, bottom: 1010 }, VIEWPORT, 240)).toBe(true)
    expect(isSpanNearViewport({ top: -200, bottom: -90 }, VIEWPORT, 240)).toBe(true)
  })

  it('leaves out a tile beyond the margin', () => {
    expect(isSpanNearViewport({ top: 1100, bottom: 1210 }, VIEWPORT, 240)).toBe(false)
    expect(isSpanNearViewport({ top: -400, bottom: -290 }, VIEWPORT, 240)).toBe(false)
  })
})
