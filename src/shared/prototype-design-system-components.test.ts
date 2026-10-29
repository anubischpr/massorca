import { describe, expect, it } from 'vitest'
import { parseComponentsHtml, parseHtmlAttributes } from './prototype-design-system-components'

const FILE = `<!doctype html>
<html><head>
<style>
  .btn { background: var(--bind-background); border-radius: var(--bind-radius); }
</style>
<script>document.title = '<section data-component="Evil">'</script>
</head><body>
<!-- <section data-component="Commented"></section> -->
<section data-component="Button" data-variants="primary secondary disabled"
  data-variant-options="primary secondary disabled hover loading"
  data-bind-background="color.primary" data-bind-radius="radius.md" data-bind-text="type.body">
  <button class="btn">Go</button>
</section>
<section data-bind-gap='space.1' data-variants='default' data-component='Tabs'>
  <div><section>nested</section></div>
</section>
<section data-variants="x">no name</section>
<section data-component="Button">duplicate</section>
<style>.second { color: red }</style>
</body></html>`

describe('parseComponentsHtml', () => {
  it('reads the style blocks and every named section in order', () => {
    const parsed = parseComponentsHtml(FILE)
    expect(parsed.sections.map((section) => section.name)).toEqual(['Button', 'Tabs'])
    expect(parsed.styleBlock).toContain('.btn { background: var(--bind-background)')
    expect(parsed.styleBlock).toContain('.second { color: red }')
  })

  it('reads variants, options and bindings whatever the attribute order and quotes', () => {
    const [button, tabs] = parseComponentsHtml(FILE).sections
    expect(button).toMatchObject({
      name: 'Button',
      variants: ['primary', 'secondary', 'disabled'],
      variantOptions: ['primary', 'secondary', 'disabled', 'hover', 'loading'],
      bindings: { background: 'color.primary', radius: 'radius.md', text: 'type.body' }
    })
    expect(button?.html).toBe('<button class="btn">Go</button>')
    expect(tabs).toMatchObject({
      name: 'Tabs',
      variants: ['default'],
      variantOptions: ['default'],
      bindings: { gap: 'space.1' }
    })
  })

  it('keeps a nested section inside its component and drops scripts and comments', () => {
    const tabs = parseComponentsHtml(FILE).sections[1]
    expect(tabs?.html).toBe('<div><section>nested</section></div>')
    expect(JSON.stringify(parseComponentsHtml(FILE))).not.toContain('Evil')
    expect(JSON.stringify(parseComponentsHtml(FILE))).not.toContain('Commented')
  })

  it('adds the shown variants to the declared options', () => {
    const parsed = parseComponentsHtml(
      '<section data-component="Card" data-variants="default selected" data-variant-options="default"></section>'
    )
    expect(parsed.sections[0]?.variantOptions).toEqual(['default', 'selected'])
  })

  it('tolerates a file that is not components.html', () => {
    expect(parseComponentsHtml('')).toEqual({ styleBlock: '', sections: [] })
    expect(parseComponentsHtml('<p>nothing</p>')).toEqual({ styleBlock: '', sections: [] })
  })

  it('leaves out an unclosed section and a stray closing tag', () => {
    expect(parseComponentsHtml('</section><section data-component="Open">text').sections).toEqual(
      []
    )
  })

  it('does not let a name reach the prototype', () => {
    const parsed = parseComponentsHtml(
      '<section data-component="__proto__"></section><section data-component="A" data-bind-__proto__="x" data-bind-a="y"></section>'
    )
    expect(parsed.sections.map((section) => section.name)).toEqual(['A'])
    expect(parsed.sections[0]?.bindings).toEqual({ a: 'y' })
  })
})

describe('parseHtmlAttributes', () => {
  it('reads quoted, single-quoted and bare values, lowercases names and decodes entities', () => {
    const attributes = parseHtmlAttributes(
      ` DATA-A="1 &amp; 2" b='x"y' c=bare disabled d="&lt;&gt;"`
    )
    expect([...attributes]).toEqual([
      ['data-a', '1 & 2'],
      ['b', 'x"y'],
      ['c', 'bare'],
      ['disabled', ''],
      ['d', '<>']
    ])
  })

  it('keeps the first of a repeated name', () => {
    expect(parseHtmlAttributes('a="1" a="2"').get('a')).toBe('1')
  })
})
