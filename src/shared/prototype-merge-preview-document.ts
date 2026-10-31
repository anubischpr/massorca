import type { PrototypeMergeReviewPart } from './prototype-merge-plan'

// The merge review's preview document, assembled from what each kept part matched in its own
// direction. This is string work only: the caller finds each match (the desktop parses with
// DOMParser, the phone composes in a WebView), so agent HTML is never markup in this module.

export type MergePreviewPlacement = 'placed' | 'unmatched'

export type MergePreviewView = 'desktop' | 'phone'

export type MergePreviewComposition = {
  html: string
  /** Where each kept part ended up, by part id. */
  placement: Readonly<Record<number, MergePreviewPlacement>>
}

/** A kept part's match: its direction's styles, and the element it matched, already sanitized. */
export type MergePreviewMatch = {
  css: string
  outerHtml: string
}

/** No network: styles inline, images and fonts only as data. */
export const MERGE_PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"

/** What a match never carries: scripts, stylesheet and base loads, and metadata. */
export const MERGE_PREVIEW_STRIPPED_SELECTOR = 'script, link, base, meta'

export function isMergePreviewEventAttribute(name: string): boolean {
  return name.toLowerCase().startsWith('on')
}

/** The anchor of a part's section: a frame moves to it by a fragment, with no reload of the page. */
export function mergePartAnchor(id: number): string {
  return `merge-part-${id}`
}

const AMBER = '#f59e0b'
// Why: the section a frame moved to is outlined by the browser's :target, so no script or reload marks it.
const TARGET_OUTLINE_CSS = `[data-part]:target{outline:2px solid ${AMBER};outline-offset:-2px}`

// Why: a regex rewrite, not a CSS parser. It maps :root/html/body to the shadow host, so a
// direction's page background, font and custom properties reach its block. It misses those names
// inside strings or comments, and @font-face and @keyframes inside a shadow root may not apply.
function scopedCss(css: string): string {
  return css
    .replace(/@import\b[^;]*;?/giu, '')
    .replace(/(^|[,{}>+~\s])(?::root|html|body)(?![\w-])/gu, '$1:host')
    .replace(/<\/style/giu, '<\\/style')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
}

function blockOf(options: {
  id: number
  letter: string
  view: MergePreviewView
  inner: string
}): string {
  const padding = options.view === 'phone' ? '14px' : '18px 22px'
  const badge = `<span style="position:absolute;top:6px;right:6px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:5px;background:${AMBER};color:#000000;font:600 11px system-ui,sans-serif">${escapeHtml(options.letter)}</span>`
  return `<div id="${mergePartAnchor(options.id)}" data-part="${options.id}" style="position:relative;box-sizing:border-box;padding:${padding};">${options.inner}${badge}</div>`
}

/**
 * The preview document for the kept parts, in plan page order. Each part is an anchored block: a part
 * with a match becomes its element in its own declarative shadow root, so the directions' styles
 * cannot reach each other; a part without one becomes a dashed placeholder in the same position.
 */
export function assembleMergePreview(input: {
  /** The parts the merge keeps, in plan page order. */
  parts: readonly Pick<PrototypeMergeReviewPart, 'id' | 'name' | 'from'>[]
  /** The match of each kept part, by part id; a part with none, or null, is unmatched. */
  matches: Readonly<Record<number, MergePreviewMatch | null | undefined>>
  view: MergePreviewView
  /** The placeholder line of a part that could not be placed. */
  unplacedText: (name: string) => string
}): MergePreviewComposition {
  const placement: Record<number, MergePreviewPlacement> = {}
  const blocks = input.parts.map((part) => {
    const shared = { id: part.id, letter: part.from, view: input.view }
    const match = input.matches[part.id]
    if (match === null || match === undefined) {
      placement[part.id] = 'unmatched'
      const text = escapeHtml(input.unplacedText(part.name))
      return blockOf({
        ...shared,
        inner: `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px dashed #b45309;border-radius:6px;font:12px system-ui,sans-serif;color:#92400e">${text}</div>`
      })
    }
    placement[part.id] = 'placed'
    return blockOf({
      ...shared,
      inner: `<template shadowrootmode="open"><style>${scopedCss(match.css)}</style>${match.outerHtml}<slot></slot></template>`
    })
  })
  // Why: the base target keeps a clicked link from navigating the frame itself.
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${MERGE_PREVIEW_CSP}"><base target="_blank"><style>${TARGET_OUTLINE_CSS}</style></head><body style="margin:0;background:#ffffff;font-family:system-ui,sans-serif">${blocks.join('')}</body></html>`
  return { html, placement }
}
