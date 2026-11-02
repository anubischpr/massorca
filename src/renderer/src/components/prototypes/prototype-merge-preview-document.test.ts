// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { PrototypeMergeReviewPart } from '../../../../shared/prototype-merge-plan'
import { composeMergePreview } from './prototype-merge-preview-document'

const HTML_A = `<!doctype html><html><head><style>
@import url("https://fonts.example/a.css");
:root { --accent: teal }
html, body { background: #fff }
body h1 { color: red }
.hero { margin: 0 }
</style></head><body>
<header class="hero" onclick="steal()"><h1 onmouseover="x()">Title A</h1><script>alert(1)</script></header>
<section id="summary">Summary A</section>
</body></html>`

const HTML_B = `<html><head><style>body { background: #10182b } .cta { color: blue }</style></head>
<body><footer><button class="cta">Go B</button></footer><div class="legal">Legal B</div></body></html>`

function part(
  id: number,
  from: string,
  selectors: Record<string, string>,
  name = `Part ${id}`
): PrototypeMergeReviewPart {
  return {
    id,
    name,
    kind: 'section',
    selectors,
    selector: selectors[from] ?? '',
    suggested: from,
    from,
    on: true
  }
}

function compose(
  parts: readonly PrototypeMergeReviewPart[],
  extra: { view?: 'desktop' | 'phone' } = {}
): ReturnType<typeof composeMergePreview> {
  return composeMergePreview({
    htmlByLetter: { A: HTML_A, B: HTML_B },
    parts,
    view: extra.view ?? 'desktop',
    unplacedText: (name) => `${name}: could not be placed`
  })
}

/** The document from the block of part `id` on: the blocks follow each other in the order of the parts. */
function blockFrom(html: string, id: number): string {
  return html.slice(html.indexOf(`<div id="merge-part-${id}" data-part="${id}"`))
}

describe('composeMergePreview', () => {
  const header = part(0, 'A', { A: 'header.hero', B: '.legal' }, 'Header')
  const button = part(1, 'B', { A: '#summary', B: 'button.cta' }, 'Button')

  it('places each part in its own declarative shadow root, in the given order', () => {
    const { html, placement } = compose([header, button])
    expect(placement).toEqual({ 0: 'placed', 1: 'placed' })
    const blocks = [...html.matchAll(/<div id="merge-part-\d+" data-part="(\d+)"/gu)].map(
      (match) => match[1]
    )
    expect(blocks).toEqual(['0', '1'])
    expect(html.match(/<template shadowrootmode="open">/gu)).toHaveLength(2)
    expect(html).toContain('Title A')
    expect(html).toContain('Go B')
    expect(html).not.toContain('Summary A')
    expect(html).not.toContain('Legal B')
  })

  it('keeps the order of the parts it is given', () => {
    const { html } = compose([button, header])
    expect(html.indexOf('Go B')).toBeLessThan(html.indexOf('Title A'))
  })

  it('turns a selector with no match, or an invalid one, into a placeholder and keeps the rest', () => {
    const missing = part(2, 'A', { A: '.nothing-here' }, 'Legal <notice>')
    const invalid = part(3, 'B', { B: ':::' })
    const { html, placement } = compose([header, missing, invalid, button])
    expect(placement).toEqual({ 0: 'placed', 2: 'unmatched', 3: 'unmatched', 1: 'placed' })
    expect(html).toContain('Legal &lt;notice&gt;: could not be placed')
    expect(html).toContain('border:1px dashed')
    expect(html).toContain('Title A')
    expect(html).toContain('Go B')
  })

  it('treats a part whose direction was not read as unmatched', () => {
    const { placement } = composeMergePreview({
      htmlByLetter: { A: HTML_A },
      parts: [button],
      view: 'desktop',
      unplacedText: (name) => name
    })
    expect(placement).toEqual({ 1: 'unmatched' })
  })

  it('rewrites :root, html and body to :host and drops @import', () => {
    const { html } = compose([header])
    expect(html).toContain(':host { --accent: teal }')
    expect(html).toContain(':host, :host { background: #fff }')
    expect(html).toContain(':host h1 { color: red }')
    expect(html).toContain('.hero { margin: 0 }')
    expect(html).not.toContain('@import')
  })

  it('gives each block only its own direction styles', () => {
    const { html } = compose([header, button])
    const first = html.slice(0, html.indexOf('<div id="merge-part-1"'))
    const second = blockFrom(html, 1)
    expect(first).toContain('--accent: teal')
    expect(first).not.toContain('color: blue')
    expect(second).toContain('color: blue')
    expect(second).not.toContain('--accent')
  })

  it('removes scripts and on* attributes from the placed element', () => {
    const { html } = compose([header])
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
    expect(html).not.toMatch(/\son\w+=/u)
    expect(html).toContain('Title A')
  })

  it('carries the content security policy that keeps the network off', () => {
    const { html } = compose([header])
    expect(html).toContain(
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:">'
    )
  })

  it('badges each block with its source letter, and outlines no block by its own style', () => {
    const { html } = compose([header, button])
    const first = html.slice(0, html.indexOf('<div id="merge-part-1"'))
    const second = blockFrom(html, 1)
    expect(first).toMatch(/>A<\/span><\/div>/u)
    expect(second).toMatch(/>B<\/span><\/div>/u)
    expect(html).not.toContain('outline:2px solid #f59e0b;outline-offset:-2px;')
    expect(html.match(/outline:2px solid #f59e0b/gu)).toHaveLength(1)
  })

  it('pads blocks tighter in the phone view', () => {
    expect(compose([header]).html).toContain('padding:18px 22px')
    expect(compose([header], { view: 'phone' }).html).toContain('padding:14px')
  })

  it('composes the same document from the same input', () => {
    const first = compose([header, button]).html
    expect(compose([header, button]).html).toBe(first)
  })
})
