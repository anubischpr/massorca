import { describe, expect, it } from 'vitest'
import { prototypeFrameLayout } from './prototype-frames'

describe('prototypeFrameLayout', () => {
  it('draws a page at its own size when the space is at least as wide', () => {
    expect(prototypeFrameLayout('phone', { width: 400, height: 900 })).toEqual({
      designWidth: 390,
      designHeight: 844,
      scale: 1,
      boxWidth: 390,
      boxHeight: 844
    })
    expect(prototypeFrameLayout('desktop', { width: 2000, height: 1200 })).toEqual({
      designWidth: 1440,
      designHeight: 900,
      scale: 1,
      boxWidth: 1440,
      boxHeight: 900
    })
  })

  it('scales the desktop artboard by width and keeps its aspect ratio', () => {
    expect(prototypeFrameLayout('desktop', { width: 720, height: 1000 })).toEqual({
      designWidth: 1440,
      designHeight: 900,
      scale: 0.5,
      boxWidth: 720,
      boxHeight: 450
    })
  })

  it('crops the artboard when the space is shorter, and the page scrolls inside it', () => {
    expect(prototypeFrameLayout('desktop', { width: 720, height: 200 })).toEqual({
      designWidth: 1440,
      designHeight: 400,
      scale: 0.5,
      boxWidth: 720,
      boxHeight: 200
    })
  })

  it('draws nothing before the space is measured', () => {
    expect(prototypeFrameLayout('phone', { width: 0, height: 0 })).toBeNull()
    expect(prototypeFrameLayout('desktop', { width: 0, height: 500 })).toBeNull()
    expect(prototypeFrameLayout('desktop', { width: 500, height: 0 })).toBeNull()
  })
})
