import { describe, expect, it } from 'vitest'
import { designSystemContentOf } from './prototype-design-system-content'

const TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' } },
  $extensions: { massorca: { version: 2, status: 'detected', agent: 'Codex' } }
})
const COMPONENTS =
  '<style>.b{color:red}</style><section data-component="Button" data-variants="primary"></section>'

describe('designSystemContentOf', () => {
  it('reads the tokens, their metadata, the components and the style block', () => {
    const content = designSystemContentOf({ tokensJson: TOKENS, componentsHtml: COMPONENTS })
    expect(content.tokens.map((token) => token.id)).toEqual(['color.primary'])
    expect(content.meta.version).toBe(2)
    expect(content.components.map((section) => section.name)).toEqual(['Button'])
    expect(content.styleBlock).toBe('.b{color:red}')
  })

  it('reads a missing or invalid file as empty', () => {
    expect(designSystemContentOf({ tokensJson: 'not json' })).toEqual({
      tokens: [],
      meta: { history: [], sources: [], palettes: [] },
      components: [],
      styleBlock: ''
    })
  })
})
