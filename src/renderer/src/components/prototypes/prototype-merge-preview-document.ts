import {
  chosenSelectorOf,
  type PrototypeMergeReviewPart
} from '../../../../shared/prototype-merge-plan'
import {
  assembleMergePreview,
  isMergePreviewEventAttribute,
  MERGE_PREVIEW_STRIPPED_SELECTOR,
  type MergePreviewComposition,
  type MergePreviewMatch,
  type MergePreviewView
} from '../../../../shared/prototype-merge-preview-document'

export type {
  MergePreviewComposition,
  MergePreviewPlacement,
  MergePreviewView
} from '../../../../shared/prototype-merge-preview-document'

// The merge review's preview: one HTML document composed from the latest HTML of the starred
// directions, with no model call. It only ever renders in a sandbox="" iframe (no scripts, no
// same-origin), and the document's CSP keeps the network off. This file reads each match from the
// direction's own document; the assembly of the document is shared with the phone.

type ParsedDirection = { document: Document; css: string }

const PARSE_CACHE_MAX = 12
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

function sanitizedClone(element: Element): Element {
  const clone = element.cloneNode(true)
  if (!(clone instanceof Element)) {
    return element
  }
  for (const unsafe of clone.querySelectorAll(MERGE_PREVIEW_STRIPPED_SELECTOR)) {
    unsafe.remove()
  }
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    for (const name of node.getAttributeNames()) {
      if (isMergePreviewEventAttribute(name)) {
        node.removeAttribute(name)
      }
    }
  }
  return clone
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

/**
 * The preview document for the kept parts, in plan page order. Each part is matched in its own
 * direction's document, and the document itself is assembled by the shared module.
 */
export function composeMergePreview(input: {
  /** The latest HTML of each starred direction, by letter. */
  htmlByLetter: Readonly<Record<string, string>>
  /** The parts the merge keeps, in plan page order. */
  parts: readonly PrototypeMergeReviewPart[]
  view: MergePreviewView
  /** The placeholder line of a part that could not be placed. */
  unplacedText: (name: string) => string
}): MergePreviewComposition {
  const matches: Record<number, MergePreviewMatch | null> = {}
  for (const part of input.parts) {
    const html = input.htmlByLetter[part.from]
    const direction = html === undefined ? undefined : parsedDirection(html)
    const element = matchedElement(direction, chosenSelectorOf(part))
    matches[part.id] =
      direction === undefined || element === null
        ? null
        : { css: direction.css, outerHtml: sanitizedClone(element).outerHTML }
  }
  return assembleMergePreview({
    parts: input.parts,
    matches,
    view: input.view,
    unplacedText: input.unplacedText
  })
}
