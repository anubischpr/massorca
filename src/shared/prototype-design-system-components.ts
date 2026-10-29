// components.html of a design system: one <style> block plus one <section data-component> per
// component. Read by string scanning, with no DOM, so it runs on the host, the renderer and mobile.

const MAX_SECTIONS = 200
const MAX_NAME_LENGTH = 80
const MAX_VARIANTS = 30

export type ComponentSection = {
  name: string
  /** The states the component shows now. */
  variants: string[]
  /** Every state the editor offers: the declared options and the shown variants. */
  variantOptions: string[]
  /** Property to token id, from the `data-bind-<prop>` attributes. */
  bindings: Record<string, string>
  /** The markup between the section tags. */
  html: string
}

export type ParsedComponents = {
  /** The text of every <style> block, in file order. */
  styleBlock: string
  sections: ComponentSection[]
}

const COMMENT = /<!--[\s\S]*?-->/gu
const SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script\s*>/giu
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/giu
const SECTION_TAG = /<(\/?)section\b((?:"[^"]*"|'[^']*'|[^'">])*)>/giu
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu
const BIND_PREFIX = 'data-bind-'

/** The style block and sections of a components.html, in file order; anything else is ignored. */
export function parseComponentsHtml(html: string): ParsedComponents {
  const withoutNoise = html.replace(COMMENT, '').replace(SCRIPT, '')
  const styles: string[] = []
  const body = withoutNoise.replace(STYLE, (_match, css: string) => {
    styles.push(css.trim())
    return ''
  })
  return {
    styleBlock: styles.filter((css) => css.length > 0).join('\n'),
    sections: sectionsOf(body)
  }
}

function sectionsOf(body: string): ComponentSection[] {
  const sections: ComponentSection[] = []
  const names = new Set<string>()
  const tags = new RegExp(SECTION_TAG.source, 'giu')
  let depth = 0
  let start = 0
  let attributes = ''
  for (let match = tags.exec(body); match !== null; match = tags.exec(body)) {
    if (match[1] === '') {
      if (depth === 0) {
        start = match.index + match[0].length
        attributes = match[2] ?? ''
      }
      depth += 1
    } else if (depth > 0) {
      depth -= 1
      if (depth === 0) {
        const section = sectionOf(attributes, body.slice(start, match.index))
        if (section !== null && !names.has(section.name) && sections.length < MAX_SECTIONS) {
          names.add(section.name)
          sections.push(section)
        }
      }
    }
  }
  return sections
}

function sectionOf(rawAttributes: string, html: string): ComponentSection | null {
  const attributes = parseHtmlAttributes(rawAttributes)
  const name = (attributes.get('data-component') ?? '').trim().slice(0, MAX_NAME_LENGTH)
  if (name.length === 0 || name === '__proto__') {
    return null
  }
  const variants = words(attributes.get('data-variants'))
  const declared = attributes.get('data-variant-options')
  const variantOptions =
    declared === undefined ? variants : unique([...words(declared), ...variants])
  const bindings: Record<string, string> = {}
  for (const [attribute, value] of attributes) {
    const prop = attribute.slice(BIND_PREFIX.length)
    const tokenId = value.trim()
    if (
      attribute.startsWith(BIND_PREFIX) &&
      prop !== '__proto__' &&
      /^[A-Za-z0-9_-]+$/u.test(prop) &&
      tokenId.length > 0
    ) {
      bindings[prop] = tokenId
    }
  }
  return { name, variants, variantOptions, bindings, html: html.trim() }
}

/** The attributes of one tag's text, names lowercased, in order; the first of a repeated name wins. */
export function parseHtmlAttributes(raw: string): Map<string, string> {
  const attributes = new Map<string, string>()
  const pattern = new RegExp(ATTRIBUTE.source, 'gu')
  for (let match = pattern.exec(raw); match !== null; match = pattern.exec(raw)) {
    const name = (match[1] ?? '').toLowerCase()
    if (name.length > 0 && !attributes.has(name)) {
      attributes.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''))
    }
  }
  return attributes
}

function words(value: string | undefined): string[] {
  return unique((value ?? '').split(/\s+/u).filter((word) => word.length > 0)).slice(
    0,
    MAX_VARIANTS
  )
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function decodeEntities(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}
