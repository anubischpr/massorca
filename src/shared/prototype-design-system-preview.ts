// The self-contained document that previews one component: the token variables with the draft
// values applied, the file's style block, and the section with its bindings. It carries no script
// and its policy forbids loading anything, so a script-less sandboxed frame can show it as is.
import type { ComponentSection } from './prototype-design-system-components'
import { designTokenCssVar, type DesignToken } from './prototype-design-system-tokens'

const POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"
const BLOCKED_PAIR = /<(script|iframe|object|embed|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu
const BLOCKED_TAG =
  /<\/?(script|iframe|object|embed|noscript|base|meta|link|frame|frameset|form)\b[^>]*>/giu
const STYLE_END = /<\/style/giu

/** A section's design with `overrides` (token id to value) and `bindingOverrides` (property to token id) applied. */
export function buildComponentPreviewDocument(
  tokens: readonly DesignToken[],
  overrides: Readonly<Record<string, string>>,
  styleBlock: string,
  section: ComponentSection,
  bindingOverrides: Readonly<Record<string, string>> = {}
): string {
  const variables = tokens.flatMap((token) => {
    const value =
      (Object.hasOwn(overrides, token.id) ? overrides[token.id] : undefined) ?? token.value
    return isSafeCssValue(value) ? [`${designTokenCssVar(token.id)}:${value.trim()};`] : []
  })
  const bindings = { ...section.bindings, ...bindingOverrides }
  const bound = Object.entries(bindings).flatMap(([prop, tokenId]) =>
    /^[A-Za-z0-9_-]+$/u.test(prop) ? [`--bind-${prop}:var(${designTokenCssVar(tokenId)});`] : []
  )
  const markup = section.html.replace(BLOCKED_PAIR, '').replace(BLOCKED_TAG, '')
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${POLICY}">`,
    `<style>:root{${variables.join('')}}body{margin:0}${styleBlock.replace(STYLE_END, '<\\/style')}</style>`,
    '</head><body>',
    `<section data-component="${escapeAttribute(section.name)}" style="${bound.join('')}">${markup}</section>`,
    '</body></html>'
  ].join('')
}

// A value that cannot end its declaration or rule, or leave a quote or bracket open, is safe to inline.
function isSafeCssValue(value: string): boolean {
  if (value.trim().length === 0 || /[{};<>\\\r\n]/u.test(value)) {
    return false
  }
  let depth = 0
  for (const character of value) {
    depth += character === '(' ? 1 : character === ')' ? -1 : 0
    if (depth < 0) {
      return false
    }
  }
  return depth === 0 && count(value, '"') % 2 === 0 && count(value, "'") % 2 === 0
}

function count(text: string, character: string): number {
  return text.split(character).length - 1
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
