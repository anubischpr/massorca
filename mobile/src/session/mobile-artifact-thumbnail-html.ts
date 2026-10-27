/** The width a page is laid out at in a thumbnail, the phone's usable width, before it is scaled down. */
export const THUMBNAIL_RENDER_WIDTH = 390

// Why: a thumbnail loads nothing from the network, and scripts are off; only inline styles and data
// images draw. The page's own links and forms never run.
const THUMBNAIL_POLICY =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:"

const HEAD_OPEN = /<head\b[^>]*>/i
const VIEWPORT_META = /<meta\b[^>]*name=["']viewport["']/i

/**
 * The page as a thumbnail loads it: a Content-Security-Policy that blocks the network and scripts,
 * and a viewport that lays it out at the thumbnail's render width when the page has none.
 */
export function thumbnailDocument(html: string): string {
  const metas = [`<meta http-equiv="Content-Security-Policy" content="${THUMBNAIL_POLICY}">`]
  if (!VIEWPORT_META.test(html)) {
    metas.push(`<meta name="viewport" content="width=${THUMBNAIL_RENDER_WIDTH}">`)
  }
  const inserted = metas.join('')
  const head = HEAD_OPEN.exec(html)
  if (head) {
    const at = head.index + head[0].length
    return html.slice(0, at) + inserted + html.slice(at)
  }
  return inserted + html
}

/** How far a render-width page shrinks to fill a thumbnail that is `width` pixels wide. */
export function thumbnailScale(width: number): number {
  return width > 0 ? width / THUMBNAIL_RENDER_WIDTH : 0
}
