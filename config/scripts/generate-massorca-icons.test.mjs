import { describe, expect, it } from 'vitest'
import { parseRoseSvg, rasterize } from './generate-massorca-icons.mjs'

// A 512 square outlined with cubic segments, so the parser and flattener both run.
const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g fill="#FF2E88">
  <path d="M0 0C170 0 341 0 512 0C512 170 512 341 512 512C341 512 170 512 0 512C0 341 0 170 0 0Z"/>
  </g>
</svg>
`

describe('parseRoseSvg', () => {
  it('reads the square viewBox, fill colour and every path', () => {
    const rose = parseRoseSvg(SQUARE_SVG)
    expect(rose.size).toBe(512)
    expect(rose.color).toEqual([255, 46, 136])
    expect(rose.polygons).toHaveLength(1)
  })

  it('rejects non-square viewBoxes and unsupported path commands', () => {
    expect(() => parseRoseSvg(SQUARE_SVG.replace('0 0 512 512', '0 0 512 256'))).toThrow(
      /square viewBox/
    )
    expect(() => parseRoseSvg(SQUARE_SVG.replace('C170', 'L170'))).toThrow(
      /unsupported path command/
    )
  })
})

describe('rasterize', () => {
  it('fully covers the pixels inside a filled square at identity placement', () => {
    const rose = parseRoseSvg(SQUARE_SVG)
    const coverage = rasterize(rose, { kind: 'identity' }, 16, 16)
    expect(coverage).toHaveLength(256)
    for (const value of coverage) {
      expect(value).toBeGreaterThan(0.99)
    }
  })

  it('keeps the fitted rose inside the requested square', () => {
    const rose = parseRoseSvg(SQUARE_SVG)
    const width = 64
    const coverage = rasterize(rose, { kind: 'fit', side: 32, cx: 32, cy: 32 }, width, width)
    let minX = width
    let maxX = -1
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        if (coverage[y * width + x] > 0.5) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
        }
      }
    }
    expect(minX).toBeGreaterThanOrEqual(15)
    expect(maxX).toBeLessThanOrEqual(48)
    expect(maxX - minX + 1).toBeGreaterThanOrEqual(31)
  })
})
