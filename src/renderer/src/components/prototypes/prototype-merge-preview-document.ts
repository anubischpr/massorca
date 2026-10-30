import {
  chosenSelectorOf,
  type PrototypeMergeReviewPart
} from '../../../../shared/prototype-merge-plan'

// The merge review's preview: one HTML document composed from the latest HTML of the starred
// directions, with no model call. It only ever renders in a sandbox="" iframe (no scripts, no
// same-origin), and the CSP below keeps the network off.

export type MergePreviewPlacement = 'placed' | 'unmatched'

export type MergePreviewView = 'desktop' | 'phone'

export type MergePreviewComposition = {
  html: string
  /** Where each kept part ended up, by part id. */
  placement: Readonly<Record<number, MergePreviewPlacement>>
}

type ParsedDirection = { document: Document; css: string }

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"
const PARSE_CACHE_MAX = 12
const AMBER = '#f59e0b'
const parseCache = new Map<string, ParsedDirection>()

function parsedDirection(html: string): ParsedDirection {
  const cached = parseCache.get(html)
  if (cached !== undefined) {
    return cached
  }
  // DOMParser documents are inert: no script runs and no resource loads.
  const document = new DOMParser().parseFromString(html, 'text/html')
  const css = [...document.querySelectorAll('style')].map((style) => style.textContent).join('\n')
  const parsed = { document, css }
  if (parseCache.size >= PARSE_CACHE_MAX) {
    const oldest = parseCache.keys().next()
    if (!oldest.done) {
      parseCache.delete(oldest.value)
    }
  }
  parseCache.set(html, parsed)
  return parsed
}

// Why: a regex rewrite, not a CSS parser. It maps :root/html/body to the shadow host, so a
// direction's page background, font and custom properties reach its block. It misses those names
// inside strings or comments, and @font-face and @keyframes inside a shadow root may not apply.
function scopedCss(css: string): string {
  return css
    .replace(/@import\b[^;]*;?/giu, '')
    .replace(/(^|[,{}>+~\s])(?::root|html|body)(?![\w-])/gu, '$1:host')
    .replace(/<\/style/giu, '<\\/style')
}

function sanitizedClone(element: Element): Element {
  const clone = element.cloneNode(true)
  if (!(clone instanceof Element)) {
    return element
  }
  for (const unsafe of clone.querySelectorAll('script, link, base, meta')) {
    unsafe.remove()
  }
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    for (const name of node.getAttributeNames()) {
      if (name.toLowerCase().startsWith('on')) {
        node.removeAttribute(name)
      }
    }
  }
  return clone
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
}

function matchedElement(direction: ParsedDirection | undefined, selector: string): Element | null {
  if (direction === undefined) {
    return null
  }
  try {
    const element = direction.document.querySelector(selector)
    const { documentElement, head } = direction.document
    return element === documentElement || element === head ? null : element
  } catch {
    // An invalid selector leaves only that part unplaced.
    return null
  }
}

function blockOf(options: {
  id: number
  letter: string
  hovered: boolean
  view: MergePreviewView
  inner: string
}): string {
  const padding = options.view === 'phone' ? '14px' : '18px 22px'
  const outline = options.hovered ? `outline:2px solid ${AMBER};outline-offset:-2px;` : ''
  const badge = `<span style="position:absolute;top:6px;right:6px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:5px;background:${AMBER};color:#000000;font:600 11px system-ui,sans-serif">${escapeHtml(options.letter)}</span>`
  return `<div data-part="${options.id}" style="position:relative;box-sizing:border-box;padding:${padding};${outline}">${options.inner}${badge}</div>`
}

/**
 * The preview document for the kept parts, in plan page order. Each placed part is its direction's
 * element in its own declarative shadow root, so the directions' styles cannot reach each other; a
 * part that matches nothing becomes a dashed placeholder in the same position.
 */
export function composeMergePreview(input: {
  /** The latest HTML of each starred direction, by letter. */
  htmlByLetter: Readonly<Record<string, string>>
  /** The parts the merge keeps, in plan page order. */
  parts: readonly PrototypeMergeReviewPart[]
  hoveredId: number | null
  view: MergePreviewView
  /** The placeholder line of a part that could not be placed. */
  unplacedText: (name: string) => string
}): MergePreviewComposition {
  const placement: Record<number, MergePreviewPlacement> = {}
  const blocks = input.parts.map((part) => {
    const html = input.htmlByLetter[part.from]
    const direction = html === undefined ? undefined : parsedDirection(html)
    const element = matchedElement(direction, chosenSelectorOf(part))
    const shared = {
      id: part.id,
      letter: part.from,
      hovered: input.hoveredId === part.id,
      view: input.view
    }
    if (direction === undefined || element === null) {
      placement[part.id] = 'unmatched'
      const text = escapeHtml(input.unplacedText(part.name))
      return blockOf({
        ...shared,
        inner: `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px dashed #b45309;border-radius:6px;font:12px system-ui,sans-serif;color:#92400e">${text}</div>`
      })
    }
    placement[part.id] = 'placed'
    const clone = sanitizedClone(element)
    return blockOf({
      ...shared,
      inner: `<template shadowrootmode="open"><style>${scopedCss(direction.css)}</style>${clone.outerHTML}<slot></slot></template>`
    })
  })
  // Why: the base target keeps a clicked link from navigating the frame itself.
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"></head><body style="margin:0;background:#ffffff;font-family:system-ui,sans-serif">${blocks.join('')}</body></html>`
  return { html, placement }
}
