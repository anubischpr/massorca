import { describe, expect, it } from 'vitest'
import { prototypeCaptureCrop } from './mobile-prototype-capture-math'

const FRAME = { width: 360, height: 640 }

describe('prototypeCaptureCrop', () => {
  it('maps a pin rectangle to its pixels in the picture of the frame', () => {
    expect(
      prototypeCaptureCrop({
        rect: { x: 10, y: 20, width: 120, height: 40 },
        scale: 1,
        pixelRatio: 3,
        frame: FRAME
      })
    ).toEqual({ originX: 30, originY: 60, width: 360, height: 120 })
  })

  it('follows a frame drawn smaller than its page', () => {
    expect(
      prototypeCaptureCrop({
        rect: { x: 100, y: 100, width: 200, height: 100 },
        scale: 0.5,
        pixelRatio: 2,
        frame: { width: 320, height: 400 }
      })
    ).toEqual({ originX: 100, originY: 100, width: 200, height: 100 })
  })

  it('keeps to the picture when the element hangs over its edge', () => {
    expect(
      prototypeCaptureCrop({
        rect: { x: -20, y: 600, width: 100, height: 100 },
        scale: 1,
        pixelRatio: 1,
        frame: FRAME
      })
    ).toEqual({ originX: 0, originY: 600, width: 80, height: 40 })
  })

  it('has no region for an element outside the frame or without size', () => {
    expect(
      prototypeCaptureCrop({
        rect: { x: 400, y: 10, width: 50, height: 50 },
        scale: 1,
        pixelRatio: 1,
        frame: FRAME
      })
    ).toBeNull()
    expect(
      prototypeCaptureCrop({
        rect: { x: 10, y: 10, width: 0, height: 20 },
        scale: 1,
        pixelRatio: 1,
        frame: FRAME
      })
    ).toBeNull()
  })
})
