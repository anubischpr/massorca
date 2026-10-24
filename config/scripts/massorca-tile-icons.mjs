// Tile icons: a rounded tile, a gradient or wash fill, the traced rose with a soft shadow and an
// optional badge. Renders straight RGBA so the generator only adds PNG and ICO encoding.
const COVERAGE_SAMPLES = 4
const TILE_CORNER_RATIO = 0.2237 // macOS icon grid corner radius, as a fraction of the tile side
const ORANGE = [255, 107, 43]
const ROSE_SHADOW = { offset: 0.012, blur: 0.012, opacity: 0.35 } // fractions of the canvas
const WASH_TOP = [150, 214, 242]
const WASH_BOTTOM = [30, 84, 200]
const WASH_BLOBS = [
  [110, 214, 222],
  [70, 150, 214],
  [150, 130, 230],
  [60, 190, 190],
  [200, 236, 250]
]

// A rounded square, given as fractions of the canvas.
export function tileBox(inset, side) {
  return { inset, side, radius: side * TILE_CORNER_RATIO }
}

// Top-to-bottom gradient across the tile, written into `out`.
export function verticalTile(top, bottom, box) {
  return (x, y, size, out) => {
    const t = Math.min(Math.max((y / size - box.inset) / box.side, 0), 1)
    for (let c = 0; c < 3; c++) {
      out[c] = top[c] + (bottom[c] - top[c]) * t
    }
    return out
  }
}

// Pigment wash: a gradient, noise-warped colour blotches and grain, all from one seed.
export function washTile(seed) {
  const random = seededRandom(seed)
  const noise = valueNoise(random)
  const blobs = WASH_BLOBS.map((colour) => ({
    colour,
    cx: 0.15 + random() * 0.7,
    cy: 0.15 + random() * 0.7,
    radius: 0.22 + random() * 0.2,
    strength: 0.45 + random() * 0.35
  }))
  return (x, y, size, out) => {
    const u = x / size
    const v = y / size
    const warp = (noise(u * 5, v * 5) - 0.5) * 0.18
    for (let c = 0; c < 3; c++) {
      out[c] = WASH_TOP[c] + (WASH_BOTTOM[c] - WASH_TOP[c]) * v
    }
    for (const blob of blobs) {
      const distance = Math.hypot(u - blob.cx, v - blob.cy) + warp
      const weight = (1 - smoothstep(blob.radius * 0.55, blob.radius, distance)) * blob.strength
      for (let c = 0; c < 3; c++) {
        out[c] += (blob.colour[c] - out[c]) * weight
      }
    }
    const grain = 0.93 + 0.14 * noise(u * 60, v * 60)
    for (let c = 0; c < 3; c++) {
      out[c] = Math.min(255, out[c] * grain)
    }
    return out
  }
}

// `spec`: tile (a tileBox), tileRgb (fills the tile), mark ({ coverage, rgb }), a shadow flag,
// and an optional badge ({ cx, cy, radius }, fractions of the canvas). Returns RGBA bytes.
export function renderTileIcon(size, spec) {
  const tile = coverageOf(size, size, (x, y) => insideTile(x, y, size, spec.tile))
  const shadow = spec.shadow
    ? markShadow(
        spec.mark.coverage,
        size,
        Math.round(ROSE_SHADOW.offset * size),
        Math.round(ROSE_SHADOW.blur * size)
      )
    : null
  const badgeLayers = spec.badge ? badgeCoverage(size, spec.badge) : null
  const out = Buffer.alloc(size * size * 4)
  const rgb = [0, 0, 0]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      spec.tileRgb(x + 0.5, y + 0.5, size, rgb)
      const shade = shadow ? 1 - ROSE_SHADOW.opacity * shadow[i] : 1
      for (let c = 0; c < 3; c++) {
        const shaded = rgb[c] * shade
        rgb[c] = shaded + (spec.mark.rgb[c] - shaded) * spec.mark.coverage[i]
      }
      let alpha = tile[i]
      // Premultiplied colour, so the badge composites over the tile edge without a fringe.
      const premult = [rgb[0] * alpha, rgb[1] * alpha, rgb[2] * alpha]
      if (badgeLayers) {
        const disc = badgeLayers.disc[i]
        for (let c = 0; c < 3; c++) {
          const colour = ORANGE[c] + (255 - ORANGE[c]) * badgeLayers.letter[i]
          premult[c] = colour * disc + premult[c] * (1 - disc)
        }
        alpha = disc + alpha * (1 - disc)
      }
      if (alpha > 0) {
        const o = i * 4
        for (let c = 0; c < 3; c++) {
          out[o + c] = Math.round(premult[c] / alpha)
        }
        out[o + 3] = Math.round(alpha * 255)
      }
    }
  }
  return out
}

// Supersampled coverage of `inside`, so tile and badge edges are anti-aliased.
function coverageOf(width, height, inside) {
  const coverage = new Float32Array(width * height)
  const step = 1 / COVERAGE_SAMPLES
  const weight = 1 / (COVERAGE_SAMPLES * COVERAGE_SAMPLES)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hits = 0
      for (let sy = 0; sy < COVERAGE_SAMPLES; sy++) {
        for (let sx = 0; sx < COVERAGE_SAMPLES; sx++) {
          if (inside(x + (sx + 0.5) * step, y + (sy + 0.5) * step)) {
            hits++
          }
        }
      }
      coverage[y * width + x] = hits * weight
    }
  }
  return coverage
}

function insideTile(x, y, size, box) {
  const half = (box.side * size) / 2
  const centre = box.inset * size + half
  const radius = box.radius * size
  const qx = Math.max(Math.abs(x - centre) - (half - radius), 0)
  const qy = Math.max(Math.abs(y - centre) - (half - radius), 0)
  return qx * qx + qy * qy <= radius * radius
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Smooth value noise in [0, 1) over a seeded lattice.
function valueNoise(random) {
  const lattice = Array.from({ length: 256 }, () => random())
  const at = (ix, iy) => lattice[((ix * 73856093) ^ (iy * 19349663)) & 255]
  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = smoothstep(0, 1, x - x0)
    const ty = smoothstep(0, 1, y - y0)
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
    return top + (bottom - top) * ty
  }
}

// The "D" on the dev badge, drawn analytically so it stays sharp at 256px.
function insideLetterD(x, y, cx, cy, r) {
  const outer = 0.42 * r
  const inner = 0.22 * r
  const dx = x - cx
  const dy = y - cy
  const distance2 = dx * dx + dy * dy
  const solid =
    (dx >= -outer && dx <= 0 && Math.abs(dy) <= outer) || (dx > 0 && distance2 <= outer * outer)
  const counter =
    (dx >= -inner && dx <= 0 && Math.abs(dy) <= inner) || (dx > 0 && distance2 <= inner * inner)
  return solid && !counter
}

function badgeCoverage(size, badge) {
  const cx = badge.cx * size
  const cy = badge.cy * size
  const r = badge.radius * size
  return {
    disc: coverageOf(size, size, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r),
    letter: coverageOf(size, size, (x, y) => insideLetterD(x, y, cx, cy, r))
  }
}

// Separable box blur with running sums; three passes approximate a Gaussian.
function boxBlur(source, size, radius) {
  const horizontal = new Float32Array(source.length)
  const out = new Float32Array(source.length)
  const norm = 1 / (2 * radius + 1)
  const clampIndex = (value) => Math.min(Math.max(value, 0), size - 1)
  for (let y = 0; y < size; y++) {
    const row = y * size
    let sum = 0
    for (let x = -radius; x <= radius; x++) {
      sum += source[row + clampIndex(x)]
    }
    for (let x = 0; x < size; x++) {
      horizontal[row + x] = sum * norm
      sum += source[row + clampIndex(x + radius + 1)] - source[row + clampIndex(x - radius)]
    }
  }
  for (let x = 0; x < size; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++) {
      sum += horizontal[clampIndex(y) * size + x]
    }
    for (let y = 0; y < size; y++) {
      out[y * size + x] = sum * norm
      sum +=
        horizontal[clampIndex(y + radius + 1) * size + x] -
        horizontal[clampIndex(y - radius) * size + x]
    }
  }
  return out
}

// The rose's shadow, cast straight down onto the tile.
function markShadow(coverage, size, offset, blur) {
  let shadow = new Float32Array(coverage.length)
  for (let y = offset; y < size; y++) {
    shadow.set(coverage.subarray((y - offset) * size, (y - offset + 1) * size), y * size)
  }
  for (let pass = 0; pass < 3; pass++) {
    shadow = boxBlur(shadow, size, blur)
  }
  return shadow
}
