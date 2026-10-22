#!/usr/bin/env node
// Regenerates every MassOrca rose icon from resources/branding/massorca-rose.svg.
// Run from the repository root: node config/scripts/generate-massorca-icons.mjs
// Why: the SVG is the source of truth; the path rasterizer below needs no native
// SVG renderer, so the script runs anywhere the repo's pngjs dependency installs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PNG } from 'pngjs'

const ROOT = join(import.meta.dirname, '..', '..')
const SOURCE_SVG = join(ROOT, 'resources/branding/massorca-rose.svg')

const CUBIC_STEPS = 16
const SUBSCANLINES = 4

const DESKTOP_FILL = 0.9
const MOBILE_ICON_FILL = 0.5
const MOBILE_BACKGROUND = [17, 17, 17] // #111111, matches app.json splash and adaptive backgrounds
const ADAPTIVE_SAFE_RADIUS = 320 / 1024 // 66% safe-zone circle, as a fraction of the canvas side
const SPLASH_ROSE_SIDE = 215
const NOTIFICATION_FILL = 0.9
const WHITE = [255, 255, 255]

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function cubicPoints(p0, p1, p2, p3, out) {
  for (let step = 1; step <= CUBIC_STEPS; step++) {
    const t = step / CUBIC_STEPS
    const u = 1 - t
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    })
  }
}

// Only absolute M, C and Z are accepted: that is the subset the traced source uses.
function parsePathData(d) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const polygons = []
  let polygon = null
  let pen = null
  let index = 0
  const readPoint = () => {
    const point = { x: Number(tokens[index]), y: Number(tokens[index + 1]) }
    index += 2
    return point
  }
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === 'M') {
      pen = readPoint()
      polygon = [pen]
      polygons.push(polygon)
    } else if (command === 'C') {
      do {
        const p1 = readPoint()
        const p2 = readPoint()
        const p3 = readPoint()
        if (!polygon) {
          throw new Error('massorca-rose.svg: cubic segment before a moveto')
        }
        cubicPoints(pen, p1, p2, p3, polygon)
        pen = p3
      } while (index < tokens.length && !/^[A-Za-z]$/.test(tokens[index]))
    } else if (command === 'Z') {
      polygon = null
    } else {
      throw new Error(`massorca-rose.svg: unsupported path command "${command}"`)
    }
  }
  return polygons
}

export function parseRoseSvg(svgText) {
  const viewBox = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svgText)
  const fill = /<g fill="(#[0-9A-Fa-f]{6})"/.exec(svgText)
  if (!viewBox || viewBox[1] !== viewBox[2] || !fill) {
    throw new Error('massorca-rose.svg: expected a square viewBox and a <g fill="#RRGGBB"> group')
  }
  const polygons = []
  for (const match of svgText.matchAll(/<path d="([^"]*)"/g)) {
    polygons.push(...parsePathData(match[1]))
  }
  return { size: Number(viewBox[1]), color: hexToRgb(fill[1]), polygons }
}

function boundsOf(polygons) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const polygon of polygons) {
    for (const point of polygon) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }
  return { minX, minY, maxX, maxY }
}

// Maps viewBox units to canvas pixels: scale plus offset.
function placeRose(rose, placement) {
  if (placement.kind === 'identity') {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  const bounds = boundsOf(rose.polygons)
  const midX = (bounds.minX + bounds.maxX) / 2
  const midY = (bounds.minY + bounds.maxY) / 2
  if (placement.kind === 'fit') {
    // Longest side of the rose's bounding box becomes `side` pixels, centred on (cx, cy).
    const scale = placement.side / Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
    return { scale, offsetX: placement.cx - midX * scale, offsetY: placement.cy - midY * scale }
  }
  // kind 'radius': the farthest point from the rose centre sits at `radius` pixels.
  let maxRadius = 0
  for (const polygon of rose.polygons) {
    for (const point of polygon) {
      maxRadius = Math.max(maxRadius, Math.hypot(point.x - midX, point.y - midY))
    }
  }
  const scale = placement.radius / maxRadius
  return { scale, offsetX: placement.cx - midX * scale, offsetY: placement.cy - midY * scale }
}

function fillSpan(coverage, row, width, x0, x1, weight) {
  const start = Math.max(0, x0)
  const end = Math.min(width, x1)
  if (end <= start) {
    return
  }
  const base = row * width
  for (let px = Math.floor(start); px < Math.ceil(end) && px < width; px++) {
    const overlap = Math.min(end, px + 1) - Math.max(start, px)
    if (overlap > 0) {
      coverage[base + px] += overlap * weight
    }
  }
}

// Nonzero winding fill with supersampled scanlines and exact horizontal span coverage.
export function rasterize(rose, placement, width, height) {
  const { scale, offsetX, offsetY } = placeRose(rose, placement)
  const edges = []
  for (const polygon of rose.polygons) {
    const points = polygon.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }))
    for (let k = 0; k < points.length; k++) {
      const a = points[k]
      const b = points[(k + 1) % points.length]
      if (a.y === b.y) {
        continue
      }
      edges.push({
        ax: a.x,
        ay: a.y,
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
        slope: (b.x - a.x) / (b.y - a.y),
        dir: b.y > a.y ? 1 : -1
      })
    }
  }
  const coverage = new Float32Array(width * height)
  const weight = 1 / SUBSCANLINES
  for (let row = 0; row < height; row++) {
    for (let sub = 0; sub < SUBSCANLINES; sub++) {
      const y = row + (sub + 0.5) / SUBSCANLINES
      const hits = []
      for (const edge of edges) {
        if (y >= edge.minY && y < edge.maxY) {
          hits.push({ x: edge.ax + (y - edge.ay) * edge.slope, dir: edge.dir })
        }
      }
      hits.sort((p, q) => p.x - q.x)
      let winding = 0
      for (let h = 0; h < hits.length - 1; h++) {
        winding += hits[h].dir
        if (winding !== 0) {
          fillSpan(coverage, row, width, hits[h].x, hits[h + 1].x, weight)
        }
      }
    }
  }
  return coverage
}

function toRgba(coverage, color, background) {
  const out = Buffer.alloc(coverage.length * 4)
  for (let i = 0; i < coverage.length; i++) {
    const alpha = Math.min(1, coverage[i])
    const o = i * 4
    if (background) {
      for (let c = 0; c < 3; c++) {
        out[o + c] = Math.round(background[c] * (1 - alpha) + color[c] * alpha)
      }
      out[o + 3] = 255
    } else {
      out[o] = color[0]
      out[o + 1] = color[1]
      out[o + 2] = color[2]
      out[o + 3] = Math.round(alpha * 255)
    }
  }
  return out
}

function encodePng(rgba, width, height, opaque) {
  const png = new PNG({ width, height })
  png.data = rgba
  // Why: iOS app icons must not carry an alpha channel, so opaque output is written as RGB.
  return PNG.sync.write(png, opaque ? { colorType: 2 } : undefined)
}

function buildIco(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = header.length
  frames.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i
    const dimension = size >= 256 ? 0 : size
    header.writeUInt8(dimension, entry)
    header.writeUInt8(dimension, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...frames.map((frame) => frame.png)])
}

function buildIcns(chunks) {
  const body = Buffer.concat(
    chunks.map(({ type, png }) => {
      const header = Buffer.alloc(8)
      header.write(type, 0, 'ascii')
      header.writeUInt32BE(png.length + 8, 4)
      return Buffer.concat([header, png])
    })
  )
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([header, body])
}

export function generateMassOrcaIcons(rose) {
  const cache = new Map()
  const desktopCoverage = (size) => {
    if (!cache.has(size)) {
      const half = size / 2
      const side = DESKTOP_FILL * size
      cache.set(size, rasterize(rose, { kind: 'fit', side, cx: half, cy: half }, size, size))
    }
    return cache.get(size)
  }
  const desktopPng = (size) =>
    encodePng(toRgba(desktopCoverage(size), rose.color, null), size, size, false)

  const outputs = new Map()
  outputs.set('resources/build/icon.png', desktopPng(1024))
  outputs.set('resources/icon.png', desktopPng(256))
  outputs.set(
    'resources/build/icon.ico',
    buildIco([256, 128, 64, 48, 32, 24, 16].map((size) => ({ size, png: desktopPng(size) })))
  )
  const icnsTypes = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
    ['ic11', 32],
    ['ic12', 64],
    ['ic13', 256],
    ['ic14', 512]
  ]
  outputs.set(
    'resources/build/icon.icns',
    buildIcns(icnsTypes.map(([type, size]) => ({ type, png: desktopPng(size) })))
  )

  const adaptiveCoverage = rasterize(
    rose,
    { kind: 'radius', radius: ADAPTIVE_SAFE_RADIUS * 1024, cx: 512, cy: 512 },
    1024,
    1024
  )
  const mobileIconCoverage = rasterize(
    rose,
    { kind: 'fit', side: MOBILE_ICON_FILL * 1024, cx: 512, cy: 512 },
    1024,
    1024
  )
  outputs.set(
    'mobile/assets/icon.png',
    encodePng(toRgba(mobileIconCoverage, rose.color, MOBILE_BACKGROUND), 1024, 1024, true)
  )
  outputs.set(
    'mobile/assets/adaptive-icon.png',
    encodePng(toRgba(adaptiveCoverage, rose.color, null), 1024, 1024, false)
  )
  outputs.set(
    'mobile/assets/adaptive-icon-monochrome.png',
    encodePng(toRgba(adaptiveCoverage, WHITE, null), 1024, 1024, false)
  )
  const splashCoverage = rasterize(
    rose,
    { kind: 'fit', side: SPLASH_ROSE_SIDE, cx: 200, cy: 127.5 },
    400,
    255
  )
  outputs.set(
    'mobile/assets/splash-icon.png',
    encodePng(toRgba(splashCoverage, rose.color, null), 400, 255, false)
  )
  const notificationSize = 96
  const notificationCoverage = rasterize(
    rose,
    { kind: 'fit', side: NOTIFICATION_FILL * notificationSize, cx: 48, cy: 48 },
    notificationSize,
    notificationSize
  )
  outputs.set(
    'mobile/assets/notification-icon.png',
    encodePng(toRgba(notificationCoverage, WHITE, null), notificationSize, notificationSize, false)
  )
  return outputs
}

function main() {
  const rose = parseRoseSvg(readFileSync(SOURCE_SVG, 'utf8'))
  for (const [relativePath, bytes] of generateMassOrcaIcons(rose)) {
    const target = join(ROOT, relativePath)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    process.stdout.write(`wrote ${relativePath}\n`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
