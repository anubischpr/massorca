import { z } from 'zod'
import {
  chosenSelectorOf,
  type PrototypeMergeReviewPart
} from '../../../src/shared/prototype-merge-plan'
import {
  assembleMergePreview,
  MERGE_PREVIEW_STRIPPED_SELECTOR,
  type MergePreviewComposition,
  type MergePreviewMatch
} from '../../../src/shared/prototype-merge-preview-document'

// The phone's merge preview. A hidden WebView finds each kept part's element in its direction's HTML
// and returns sanitized fragments as data; the app assembles the page from them with the shared
// assembly. The composer runs only the script below, with no network, so agent HTML is never run in
// the app's JavaScript context, and the assembled page is shown in a view with JavaScript off.

/** The composer's one script: it parses with DOMParser, which runs no script and loads nothing. */
export const MERGE_PREVIEW_COMPOSER_SCRIPT = `(function () {
  var STRIPPED = ${JSON.stringify(MERGE_PREVIEW_STRIPPED_SELECTOR)};
  var CACHE_MAX = 12;
  var cache = new Map();

  function parsed(html) {
    var hit = cache.get(html);
    if (hit !== undefined) return hit;
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var css = Array.prototype.map.call(doc.querySelectorAll('style'), function (style) {
      return style.textContent;
    }).join('\\n');
    var entry = { doc: doc, css: css };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(html, entry);
    return entry;
  }

  function matchOf(doc, selector) {
    try {
      var element = doc.querySelector(selector);
      if (element === null || element === doc.documentElement || element === doc.head) return null;
      return element;
    } catch (error) {
      return null;
    }
  }

  function sanitizedHtml(element) {
    var clone = element.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll(STRIPPED), function (node) {
      node.remove();
    });
    [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*'))).forEach(function (node) {
      Array.prototype.slice.call(node.getAttributeNames()).forEach(function (name) {
        if (name.toLowerCase().indexOf('on') === 0) node.removeAttribute(name);
      });
    });
    return clone.outerHTML;
  }

  function compose(request) {
    var css = {};
    var outer = {};
    request.parts.forEach(function (part) {
      var html = request.directions[part.from];
      if (typeof html !== 'string') {
        outer[part.id] = null;
        return;
      }
      var entry = parsed(html);
      css[part.from] = entry.css;
      var element = matchOf(entry.doc, part.selector);
      outer[part.id] = element === null ? null : sanitizedHtml(element);
    });
    return { requestId: request.requestId, ok: true, css: css, outer: outer };
  }

  window.__orcaComposeMergePreview = function (request) {
    var response;
    try {
      response = compose(request);
    } catch (error) {
      response = { requestId: request.requestId, ok: false };
    }
    window.ReactNativeWebView.postMessage(JSON.stringify(response));
  };
})();`

/** The composer's page: no network and no other load; its one inline script is ours. */
export const MERGE_PREVIEW_COMPOSER_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"></head><body><script>${MERGE_PREVIEW_COMPOSER_SCRIPT}</script></body></html>`

export type MergePreviewRequest = {
  requestId: number
  /** The latest HTML of each direction a kept part comes from, by letter. */
  directions: Readonly<Record<string, string>>
  parts: readonly { id: number; from: string; selector: string }[]
}

const MergePreviewResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    requestId: z.number().int(),
    ok: z.literal(true),
    css: z.record(z.string(), z.string()),
    outer: z.record(z.string(), z.string().nullable())
  }),
  z.object({ requestId: z.number().int(), ok: z.literal(false) })
])

export type MergePreviewResponse = z.infer<typeof MergePreviewResponseSchema>

/** The request for the kept parts; a part whose direction was not read has no HTML and stays unplaced. */
export function buildMergePreviewRequest(input: {
  requestId: number
  htmlByLetter: Readonly<Record<string, string>>
  /** The parts the merge keeps. */
  parts: readonly PrototypeMergeReviewPart[]
}): MergePreviewRequest {
  const directions: Record<string, string> = {}
  for (const part of input.parts) {
    const html = input.htmlByLetter[part.from]
    if (html !== undefined) {
      directions[part.from] = html
    }
  }
  return {
    requestId: input.requestId,
    directions,
    parts: input.parts.map((part) => ({
      id: part.id,
      from: part.from,
      selector: chosenSelectorOf(part)
    }))
  }
}

/** The script that hands one request to the composer's page, with its JSON kept as a literal. */
export function mergePreviewComposeScript(request: MergePreviewRequest): string {
  const json = JSON.stringify(request)
    .replace(new RegExp(String.fromCharCode(0x2028), 'gu'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'gu'), '\\u2029')
  return `window.__orcaComposeMergePreview(${json}); true;`
}

/** The composer's message, or null when the text is not one it sends. */
export function readMergePreviewResponse(data: string): MergePreviewResponse | null {
  let json: unknown
  try {
    json = JSON.parse(data)
  } catch {
    return null
  }
  const parsed = MergePreviewResponseSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

/** The preview page for the kept parts, from the fragments the composer found. */
export function mergePreviewFromResponse(input: {
  /** The parts the merge keeps, in plan page order. */
  parts: readonly PrototypeMergeReviewPart[]
  response: Extract<MergePreviewResponse, { ok: true }>
}): MergePreviewComposition {
  const matches: Record<number, MergePreviewMatch | null> = {}
  for (const part of input.parts) {
    const outerHtml = input.response.outer[String(part.id)] ?? null
    const css = input.response.css[part.from]
    matches[part.id] = outerHtml === null || css === undefined ? null : { css, outerHtml }
  }
  return assembleMergePreview({
    parts: input.parts,
    matches,
    view: 'phone',
    unplacedText: unplacedLine
  })
}

// The English value of the desktop's mergePreviewUnplaced key; mobile has no translation layer.
function unplacedLine(name: string): string {
  return `${name}: couldn't be placed in the preview. The agent includes it in the result.`
}
