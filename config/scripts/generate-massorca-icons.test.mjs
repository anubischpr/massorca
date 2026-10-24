import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { beforeAll, describe, expect, it } from 'vitest'
import { generateMassOrcaIcons, parseRoseSvg, rasterize } from './generate-massorca-icons.mjs'

// A 512 square outlined with cubic segments, so the parser and flattener both run.
const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g fill="#FF2E88">
  <path d="M0 0C170 0 341 0 512 0C512 170 512 341 512 512C341 512 170 512 0 512C0 341 0 170 0 0Z"/>
  </g>
</svg>
`

const ROSE_SVG = readFileSync(
  new URL('../../resources/branding/massorca-rose.svg', import.meta.url),
  'utf8'
)

const EXPECTED_OUTPUTS = [
  'docs/site/public/docs/favicon.ico',
  'docs/site/public/docs/logo.svg',
  'mobile/assets/adaptive-icon-monochrome.png',
  'mobile/assets/adaptive-icon.png',
  'mobile/assets/icon.png',
  'mobile/assets/notification-icon.png',
  'mobile/assets/splash-icon.png',
  'mobile/src/components/massorca-rose-paths.ts',
  'resources/app-icons/orca-blue.png',
  'resources/app-icons/orca-watercolor.png',
  'resources/build/icon.icns',
  'resources/build/icon.ico',
  'resources/build/icon.png',
  'resources/icon-dev.png',
  'resources/icon-source/icon.icon/Assets/logo.svg',
  'resources/icon.png',
  'resources/logo.svg',
  'resources/tray/orca-menu-barTemplate.png',
  'resources/tray/orca-menu-barTemplate@2x.png',
  'src/shared/massorca-rose-paths.ts'
]

function decode(bytes) {
  return PNG.sync.read(bytes)
}

function pixel(png, x, y) {
  const i = (y * png.width + x) * 4
  return [...png.data.subarray(i, i + 4)]
}

function countPixels(png, predicate) {
  let count = 0
  for (let i = 0; i < png.data.length; i += 4) {
    if (predicate(png.data, i)) {
      count++
    }
  }
  return count
}

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

  it('keeps the traced rose as five path strings for the shared logo module', () => {
    const rose = parseRoseSvg(ROSE_SVG)
    expect(rose.paths).toHaveLength(10)
    expect(rose.viewBox).toBe('0 0 512 512')
    expect(rose.hex).toBe('#FF2E88')
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

describe('generateMassOrcaIcons', () => {
  let outputs

  beforeAll(() => {
    outputs = generateMassOrcaIcons(parseRoseSvg(ROSE_SVG))
  }, 120_000)

  it('writes every shipped asset and the shared rose modules', () => {
    expect([...outputs.keys()].sort()).toEqual([...EXPECTED_OUTPUTS].sort())
  })

  it('makes the menu-bar templates black silhouettes at the shipped 22x14 and 44x28 sizes', () => {
    for (const [path, width, height] of [
      ['resources/tray/orca-menu-barTemplate.png', 22, 14],
      ['resources/tray/orca-menu-barTemplate@2x.png', 44, 28]
    ]) {
      const png = decode(outputs.get(path))
      expect([png.width, png.height]).toEqual([width, height])
      const visible = countPixels(png, (data, i) => data[i + 3] > 0)
      const coloured = countPixels(
        png,
        (data, i) => data[i + 3] > 0 && (data[i] | data[i + 1] | data[i + 2]) !== 0
      )
      expect(visible).toBeGreaterThan((width * height) / 10)
      expect(coloured).toBe(0)
    }
  })

  it('draws the alternate app icons as rounded tiles with a white rose and transparent corners', () => {
    for (const path of [
      'resources/app-icons/orca-blue.png',
      'resources/app-icons/orca-watercolor.png'
    ]) {
      const png = decode(outputs.get(path))
      expect([png.width, png.height]).toEqual([1024, 1024])
      expect(pixel(png, 4, 4)[3]).toBe(0)
      expect(pixel(png, 512, 512)[3]).toBe(255)
      const white = countPixels(
        png,
        (data, i) => data[i + 3] === 255 && data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245
      )
      expect(white).toBeGreaterThan(100_000)
    }
  })

  it('draws the dev icon as the pink rose on a dark tile, with the orange badge', () => {
    const png = decode(outputs.get('resources/icon-dev.png'))
    expect([png.width, png.height]).toEqual([256, 256])
    expect(pixel(png, 2, 2)[3]).toBe(0)
    const [r, g, b, a] = pixel(png, 224, 206)
    expect(a).toBe(255)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeGreaterThan(80)
    expect(g).toBeLessThan(140)
    expect(b).toBeLessThan(90)
    const pink = countPixels(
      png,
      (data, i) => data[i + 3] === 255 && data[i] > 200 && data[i + 1] < 90 && data[i + 2] > 100
    )
    expect(pink).toBeGreaterThan(2000)
  })

  it('packs the docs favicon at the six sizes the docs site already ships', () => {
    const ico = outputs.get('docs/site/public/docs/favicon.ico')
    expect(ico.readUInt16LE(2)).toBe(1)
    const sizes = Array.from(
      { length: ico.readUInt16LE(4) },
      (_, i) => ico.readUInt8(6 + 16 * i) || 256
    )
    expect(sizes).toEqual([256, 128, 64, 48, 32, 16])
  })

  it('copies the rose SVG to every logo path and writes the same paths into both logo modules', () => {
    for (const path of [
      'resources/logo.svg',
      'resources/icon-source/icon.icon/Assets/logo.svg',
      'docs/site/public/docs/logo.svg'
    ]) {
      expect(outputs.get(path).toString('utf8')).toBe(ROSE_SVG)
    }
    const shared = outputs.get('src/shared/massorca-rose-paths.ts').toString('utf8')
    expect(shared).toContain("export const MASSORCA_ROSE_COLOR = '#FF2E88'")
    expect(shared).toContain("export const MASSORCA_ROSE_VIEWBOX = '0 0 512 512'")
    expect(shared.match(/^  '/gm)).toHaveLength(parseRoseSvg(ROSE_SVG).paths.length)
    expect(outputs.get('mobile/src/components/massorca-rose-paths.ts').toString('utf8')).toBe(
      shared
    )
  })
})
