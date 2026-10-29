import { describe, expect, it } from 'vitest'
import { prototypeFrameLayout } from './mobile-prototype-frame-layout'

describe('prototypeFrameLayout', () => {
  it('lays a phone page out at its own width when the screen is as wide', () => {
    expect(prototypeFrameLayout('phone', { width: 400, height: 500 })).toEqual({
      designWidth: 360,
      designHeight: 500,
      scale: 1,
      boxWidth: 360,
      boxHeight: 500
    })
  })

  it('shrinks a page wider than the screen to fit it, and gives it the height that fills the frame', () => {
    const layout = prototypeFrameLayout('desktop', { width: 320, height: 400 })
    expect(layout?.designWidth).toBe(640)
    expect(layout?.scale).toBe(0.5)
    expect(layout?.boxWidth).toBe(320)
    expect(layout?.designHeight).toBe(800)
  })

  it('draws nothing before the area is measured', () => {
    expect(prototypeFrameLayout('phone', { width: 0, height: 0 })).toBeNull()
  })
})
