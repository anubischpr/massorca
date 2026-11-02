import { describe, expect, it } from 'vitest'
import type { PrototypeMergeReviewPart } from './prototype-merge-plan'
import {
  assembleMergePreview,
  mergePartAnchor,
  MERGE_PREVIEW_CSP
} from './prototype-merge-preview-document'

function part(id: number, from: string, name = `Part ${id}`): PrototypeMergeReviewPart {
  return {
    id,
    name,
    kind: 'section',
    selectors: { [from]: `.p${id}` },
    selector: `.p${id}`,
    suggested: from,
    from,
    on: true
  }
}

function assemble(
  matches: Parameters<typeof assembleMergePreview>[0]['matches'],
  view: 'desktop' | 'phone' = 'desktop'
) {
  return assembleMergePreview({
    parts: [part(0, 'A'), part(1, 'C', 'Pay <button>')],
    matches,
    view,
    unplacedText: (name) => `${name}: not placed`
  })
}

describe('assembleMergePreview', () => {
  it('places a matched part in its own declarative shadow root, with its styles and letter badge', () => {
    const { html, placement } = assemble({
      0: { css: 'h1 { color: red }', outerHtml: '<h1>Title A</h1>' },
      1: { css: '', outerHtml: '<button>Go</button>' }
    })
    expect(placement).toEqual({ 0: 'placed', 1: 'placed' })
    expect(html.match(/<template shadowrootmode="open">/gu)).toHaveLength(2)
    expect(html).toContain('<style>h1 { color: red }</style><h1>Title A</h1><slot></slot>')
    expect(html).toContain('>A</span>')
    expect(html).toContain('>C</span>')
  })

  it('keeps the order of the parts it is given', () => {
    const { html } = assembleMergePreview({
      parts: [part(1, 'C'), part(0, 'A')],
      matches: {
        0: { css: '', outerHtml: '<p>first</p>' },
        1: { css: '', outerHtml: '<p>second</p>' }
      },
      view: 'desktop',
      unplacedText: (name) => name
    })
    expect(html.indexOf('second')).toBeLessThan(html.indexOf('first'))
  })

  it('turns an unmatched part into the escaped placeholder line and keeps the rest', () => {
    const { html, placement } = assemble({ 0: { css: '', outerHtml: '<p>kept</p>' } })
    expect(placement).toEqual({ 0: 'placed', 1: 'unmatched' })
    expect(html).toContain('<p>kept</p>')
    expect(html).toContain('Pay &lt;button&gt;: not placed')
    expect(html.match(/<template shadowrootmode="open">/gu)).toHaveLength(1)
  })

  it('rewrites :root, html and body to :host and drops @import', () => {
    const css =
      '@import url("https://fonts.example/a.css"); :root { --accent: teal } body h1 { color: red }'
    const { html } = assemble({ 0: { css, outerHtml: '<h1>x</h1>' } })
    expect(html).toContain(':host { --accent: teal } :host h1 { color: red }')
    expect(html).not.toContain('@import')
  })

  it('does not let a style text close its block early', () => {
    const { html } = assemble({
      0: { css: 'p { color: red } </style><script>alert(1)</script>', outerHtml: '<p>x</p>' }
    })
    expect(html).not.toContain('</style><script>')
    expect(html).toContain('<\\/style><script>alert(1)</script>')
  })

  it('anchors every part by id, and outlines only the section a frame navigates to', () => {
    const { html } = assemble({
      0: { css: '', outerHtml: '<p>a</p>' },
      1: { css: '', outerHtml: '<p>b</p>' }
    })
    expect(html).toContain(`id="${mergePartAnchor(0)}" data-part="0"`)
    expect(html).toContain(`id="${mergePartAnchor(1)}" data-part="1"`)
    expect(html).toContain('[data-part]:target{outline:2px solid #f59e0b;outline-offset:-2px}')
    // Why: no part carries an outline of its own, so a change of target never rewrites the page.
    expect(html.match(/outline:/gu)).toHaveLength(1)
  })

  it('pads phone blocks tighter than desktop blocks', () => {
    const matches = { 0: { css: '', outerHtml: '<p>a</p>' } }
    expect(assemble(matches).html).toContain('padding:18px 22px')
    expect(assemble(matches, 'phone').html).toContain('padding:14px;')
  })

  it('carries the content security policy that keeps the network off', () => {
    const { html } = assemble({})
    expect(html).toContain(`content="${MERGE_PREVIEW_CSP}"`)
    expect(MERGE_PREVIEW_CSP).toContain("default-src 'none'")
  })
})
