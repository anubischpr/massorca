// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeMergeReviewPart } from '../../../src/shared/prototype-merge-plan'
import {
  buildMergePreviewRequest,
  MERGE_PREVIEW_COMPOSER_DOCUMENT,
  MERGE_PREVIEW_COMPOSER_SCRIPT,
  mergePreviewComposeScript,
  mergePreviewFromResponse,
  readMergePreviewResponse
} from './mobile-merge-preview-composer'

const LINE_SEPARATOR = String.fromCharCode(0x2028)

const HTML_A = `<!doctype html><html><head><style>
@import url("https://fonts.example/a.css");
:root { --accent: teal }
body h1 { color: red }
.hero { margin: 0 }
</style></head><body>
<header class="hero" onclick="steal()"><h1 onmouseover="x()">Title A</h1><script>alert(1)</script></header>
<section id="summary">Summary A</section>
</body></html>`

const post = vi.fn<(message: string) => void>()

beforeEach(() => {
  post.mockClear()
  Object.defineProperty(window, 'ReactNativeWebView', {
    value: { postMessage: post },
    configurable: true
  })
})

/** The composer page runs its script, then the app's injected request; the reply is what it posts. */
function answerOf(script: string): string {
  new Function(MERGE_PREVIEW_COMPOSER_SCRIPT)()
  new Function(script)()
  const [message] = post.mock.calls.at(-1) ?? []
  if (message === undefined) {
    throw new Error('the composer did not answer')
  }
  return message
}

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

describe('the composer page', () => {
  it('has no network and runs only its own script', () => {
    expect(MERGE_PREVIEW_COMPOSER_DOCUMENT).toContain(
      "content=\"default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\""
    )
    expect(MERGE_PREVIEW_COMPOSER_DOCUMENT).toContain(
      `<script>${MERGE_PREVIEW_COMPOSER_SCRIPT}</script>`
    )
  })
})

describe('the composer script', () => {
  it('returns the element a selector matches, with no script and no event attribute', () => {
    const reply = answerOf(
      mergePreviewComposeScript({
        requestId: 1,
        directions: { A: HTML_A },
        parts: [{ id: 0, from: 'A', selector: '.hero' }]
      })
    )
    expect(JSON.parse(reply)).toMatchObject({
      requestId: 1,
      ok: true,
      outer: { 0: '<header class="hero"><h1>Title A</h1></header>' }
    })
  })

  it('returns the direction styles, and null for a selector with no match, an invalid one, or the root', () => {
    const reply = JSON.parse(
      answerOf(
        mergePreviewComposeScript({
          requestId: 2,
          directions: { A: HTML_A },
          parts: [
            { id: 0, from: 'A', selector: 'h1.absent' },
            { id: 1, from: 'A', selector: '[' },
            { id: 2, from: 'A', selector: 'html' },
            { id: 3, from: 'A', selector: 'head' },
            { id: 4, from: 'C', selector: '.hero' }
          ]
        })
      )
    )
    expect(reply.outer).toEqual({ 0: null, 1: null, 2: null, 3: null, 4: null })
    expect(reply.css.A).toContain('.hero { margin: 0 }')
  })

  it('answers a request it cannot read with ok false, for the same request id', () => {
    const reply = readMergePreviewResponse(
      answerOf('window.__orcaComposeMergePreview({ requestId: 7 });')
    )
    expect(reply).toEqual({ requestId: 7, ok: false })
  })

  it('keeps a line separator in a selector as an escape, so the request stays one script', () => {
    const script = mergePreviewComposeScript({
      requestId: 3,
      directions: { A: HTML_A },
      parts: [{ id: 0, from: 'A', selector: `.hero${LINE_SEPARATOR}` }]
    })
    expect(script).not.toContain(LINE_SEPARATOR)
    expect(readMergePreviewResponse(answerOf(script))).toMatchObject({ requestId: 3, ok: true })
  })
})

describe('the composed page', () => {
  const kept = [part(0, 'A', { A: '.hero' }, 'Hero'), part(1, 'C', { C: '.missing' }, 'Pay button')]

  it('is built from the composer reply, with a placeholder for the part that matched nothing', () => {
    const request = buildMergePreviewRequest({
      requestId: 4,
      htmlByLetter: { A: HTML_A, C: '<p>other</p>' },
      parts: kept
    })
    const response = readMergePreviewResponse(answerOf(mergePreviewComposeScript(request)))
    if (response === null || !response.ok) {
      throw new Error('expected an answer')
    }
    const composition = mergePreviewFromResponse({ parts: kept, response })
    expect(composition.placement).toEqual({ 0: 'placed', 1: 'unmatched' })
    expect(composition.html).toContain('<h1>Title A</h1>')
    expect(composition.html).toContain(
      "Pay button: couldn't be placed in the preview. The agent includes it in the result."
    )
    expect(composition.html).not.toContain('<script>')
  })

  it('carries each direction styles only into its own block', () => {
    const composition = mergePreviewFromResponse({
      parts: kept,
      response: {
        requestId: 5,
        ok: true,
        css: { A: 'h1 { color: red }', C: 'p { color: blue }' },
        outer: { '0': '<h1>x</h1>', '1': '<p>y</p>' }
      }
    })
    expect(composition.html).toContain('<style>h1 { color: red }</style><h1>x</h1>')
    expect(composition.html).toContain('<style>p { color: blue }</style><p>y</p>')
  })
})

describe('the request and the reply', () => {
  it('sends only the directions the parts use, with the chosen selector of each part', () => {
    const request = buildMergePreviewRequest({
      requestId: 6,
      htmlByLetter: { A: 'a', B: 'b', C: 'c' },
      parts: [part(0, 'A', { A: '.hero', B: '.hero-b' }), part(1, 'C', { C: '.buy' })]
    })
    expect(request).toEqual({
      requestId: 6,
      directions: { A: 'a', C: 'c' },
      parts: [
        { id: 0, from: 'A', selector: '.hero' },
        { id: 1, from: 'C', selector: '.buy' }
      ]
    })
  })

  it('reads only the composer messages it knows, and nothing that is not JSON', () => {
    expect(readMergePreviewResponse('not json')).toBeNull()
    expect(readMergePreviewResponse('{"requestId":1,"ok":"yes"}')).toBeNull()
    expect(readMergePreviewResponse('{"requestId":1,"ok":false}')).toEqual({
      requestId: 1,
      ok: false
    })
  })
})
