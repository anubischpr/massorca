import { describe, expect, it } from 'vitest'
import type { ComponentSection } from './prototype-design-system-components'
import { buildComponentPreviewDocument } from './prototype-design-system-preview'
import type { DesignToken } from './prototype-design-system-tokens'

function token(id: string, value: string): DesignToken {
  const [group = '', name = ''] = id.split('.')
  return { id, group, name, type: group, value }
}

const TOKENS = [
  token('color.primary', '#2563eb'),
  token('color.foreground', '#0a0a0a'),
  token('radius.md', '8px')
]

const BUTTON: ComponentSection = {
  name: 'Button',
  variants: ['primary'],
  variantOptions: ['primary'],
  bindings: { background: 'color.primary', radius: 'radius.md' },
  html: '<button class="btn">Go</button>'
}

const STYLE = '.btn { background: var(--bind-background); }'

describe('buildComponentPreviewDocument', () => {
  it('declares the token variables, the style block, the bindings and the section', () => {
    const html = buildComponentPreviewDocument(TOKENS, {}, STYLE, BUTTON)
    expect(html).toContain(
      ':root{--color-primary:#2563eb;--color-foreground:#0a0a0a;--radius-md:8px;}'
    )
    expect(html).toContain(STYLE)
    expect(html).toContain(
      '<section data-component="Button" style="--bind-background:var(--color-primary);--bind-radius:var(--radius-md);"><button class="btn">Go</button></section>'
    )
  })

  it('applies the draft values and the draft bindings', () => {
    const html = buildComponentPreviewDocument(
      TOKENS,
      { 'color.primary': '#1d4ed8' },
      STYLE,
      BUTTON,
      { background: 'color.foreground' }
    )
    expect(html).toContain('--color-primary:#1d4ed8;')
    expect(html).toContain('--bind-background:var(--color-foreground);')
    expect(html).toContain('--bind-radius:var(--radius-md);')
  })

  it('carries no script and forbids loading anything', () => {
    const html = buildComponentPreviewDocument(TOKENS, {}, STYLE, {
      ...BUTTON,
      html: '<script>alert(1)</script><p>x</p><iframe src="//e"></iframe><link rel="stylesheet" href="//e"><meta http-equiv="refresh" content="0"><form><input></form>'
    })
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<link')
    expect(html).not.toContain('refresh')
    expect(html).not.toContain('<form')
    expect(html).toContain('<p>x</p>')
    expect(html).toContain('Content-Security-Policy" content="default-src \'none\'')
  })

  it('escapes the component name in its attribute', () => {
    const html = buildComponentPreviewDocument(TOKENS, {}, '', { ...BUTTON, name: 'A"><b>' })
    expect(html).toContain('data-component="A&quot;&gt;&lt;b&gt;"')
  })

  it('leaves out a value that could break out of its declaration', () => {
    const html = buildComponentPreviewDocument(
      TOKENS,
      {
        'color.primary': 'red;} body{display:none',
        'color.foreground': 'url(x',
        'radius.md': '"open'
      },
      '',
      BUTTON
    )
    expect(html).toContain(':root{}')
    expect(html).not.toContain('display:none')
  })

  it('keeps a style block from closing its own tag early', () => {
    const html = buildComponentPreviewDocument(TOKENS, {}, 'a{}</style><script>x</script>', BUTTON)
    expect(html).toContain('a{}<\\/style><script>x</script>')
    expect(html.match(/<\/style>/gu)).toHaveLength(1)
  })

  it('skips a binding whose property is not a plain identifier', () => {
    const html = buildComponentPreviewDocument(TOKENS, {}, '', BUTTON, { 'x;y': 'color.primary' })
    expect(html).not.toContain('x;y')
  })
})
