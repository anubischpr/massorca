import { describe, expect, it } from 'vitest'
import {
  thumbnailDocument,
  thumbnailScale,
  THUMBNAIL_RENDER_WIDTH
} from './mobile-artifact-thumbnail-html'

const POLICY = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:"

describe('thumbnailDocument', () => {
  it('puts the network-blocking policy right after the head opens', () => {
    const doc = thumbnailDocument('<html><head><title>x</title></head><body>hi</body></html>')
    expect(doc.indexOf(POLICY)).toBeGreaterThan(doc.indexOf('<head>'))
    expect(doc.indexOf(POLICY)).toBeLessThan(doc.indexOf('<title>'))
    expect(doc).toContain('width=390')
  })

  it('prepends the policy to a fragment that has no head', () => {
    const doc = thumbnailDocument('<svg viewBox="0 0 10 10"></svg>')
    expect(doc.startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true)
    expect(doc.endsWith('<svg viewBox="0 0 10 10"></svg>')).toBe(true)
  })

  it('keeps the page viewport when it already declares one', () => {
    const doc = thumbnailDocument(
      '<head><meta name="viewport" content="width=device-width"></head>'
    )
    expect(doc.match(/name="viewport"/g)).toHaveLength(1)
    expect(doc).not.toContain('width=390')
  })
})

describe('thumbnailScale', () => {
  it('scales the render width down to the thumbnail width', () => {
    expect(thumbnailScale(195)).toBeCloseTo(195 / THUMBNAIL_RENDER_WIDTH)
  })

  it('draws nothing before the thumbnail has a width', () => {
    expect(thumbnailScale(0)).toBe(0)
  })
})
