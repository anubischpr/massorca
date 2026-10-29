import { describe, expect, it } from 'vitest'
import { designTokenCssVar, parseDesignTokens } from './prototype-design-system-tokens'

const FULL = {
  color: {
    primary: { $type: 'color', $value: '#2563eb', $description: 'Actions' },
    background: { $value: '#ffffff' }
  },
  type: {
    display: {
      $value: '32px',
      $description: 'Display',
      $extensions: { massorca: { weight: 600 } }
    },
    body: { $value: 14 }
  },
  space: { 1: { $value: '4px' } },
  radius: { md: { $value: '8px' } },
  shadow: { card: { $value: '0 1px 2px #0003' } },
  motion: { fast: { $value: '120ms' } },
  $extensions: {
    massorca: {
      version: 2,
      status: 'proposed',
      agent: 'Codex',
      updatedAt: '2026-10-29',
      history: [{ version: 1, status: 'detected', at: '2026-10-21' }],
      sources: [{ path: 'src/assets/main.css', took: ':root and .dark → 8 colors' }],
      palettes: [
        {
          id: 'A',
          name: 'Calm blue',
          note: 'One blue accent',
          swatches: ['#2563eb', '#0f172a'],
          tokens: { 'color.primary': '#2563eb' }
        }
      ]
    }
  }
}

describe('parseDesignTokens', () => {
  it('reads every group in order with ids, types, descriptions and weights', () => {
    const parsed = parseDesignTokens(JSON.stringify(FULL))
    expect(parsed?.tokens.map((token) => token.id)).toEqual([
      'color.primary',
      'color.background',
      'type.display',
      'type.body',
      'space.1',
      'radius.md',
      'shadow.card',
      'motion.fast'
    ])
    expect(parsed?.tokens[0]).toEqual({
      id: 'color.primary',
      group: 'color',
      name: 'primary',
      type: 'color',
      value: '#2563eb',
      description: 'Actions'
    })
    expect(parsed?.tokens[1]?.type).toBe('color')
    expect(parsed?.tokens[2]).toMatchObject({ weight: 600, description: 'Display' })
    expect(parsed?.tokens[3]?.value).toBe('14')
  })

  it('reads the metadata', () => {
    expect(parseDesignTokens(JSON.stringify(FULL))?.meta).toEqual({
      version: 2,
      status: 'proposed',
      agent: 'Codex',
      updatedAt: '2026-10-29',
      history: [{ version: 1, status: 'detected', at: '2026-10-21' }],
      sources: [{ path: 'src/assets/main.css', took: ':root and .dark → 8 colors' }],
      palettes: [
        {
          id: 'A',
          name: 'Calm blue',
          note: 'One blue accent',
          swatches: ['#2563eb', '#0f172a'],
          tokens: { 'color.primary': '#2563eb' }
        }
      ]
    })
  })

  it('keeps the tokens when the metadata is missing', () => {
    const parsed = parseDesignTokens(JSON.stringify({ color: { primary: { $value: '#fff' } } }))
    expect(parsed?.tokens).toHaveLength(1)
    expect(parsed?.meta).toEqual({ history: [], sources: [], palettes: [] })
  })

  it('drops invalid parts and keeps the valid ones', () => {
    const parsed = parseDesignTokens(
      JSON.stringify({
        color: { ok: { $value: '#fff' }, noValue: { $type: 'color' }, objectValue: { $value: {} } },
        radius: 'not a group',
        $extensions: {
          massorca: {
            version: 'two',
            status: 'draft',
            agent: 7,
            history: [{ version: 0 }, { version: 3, status: 'bogus' }, 'x'],
            sources: [{ took: 'no path' }, { path: 'a.css' }],
            palettes: [{ id: 'A' }, { id: 'B', name: 'Warm', swatches: 'nope', tokens: { a: 1 } }]
          }
        }
      })
    )
    expect(parsed?.tokens.map((token) => token.id)).toEqual(['color.ok'])
    expect(parsed?.meta).toEqual({
      history: [{ version: 3 }],
      sources: [{ path: 'a.css', took: '' }],
      palettes: [{ id: 'B', name: 'Warm', swatches: [], tokens: {} }]
    })
  })

  it('reads nested groups and other groups after the known ones', () => {
    const parsed = parseDesignTokens(
      JSON.stringify({
        brand: { logo: { $value: 'x' } },
        color: { brand: { primary: { $value: '#111' } } }
      })
    )
    expect(parsed?.tokens.map((token) => token.id)).toEqual(['color.brand.primary', 'brand.logo'])
  })

  it('returns null when the text is not a JSON object', () => {
    expect(parseDesignTokens('')).toBeNull()
    expect(parseDesignTokens('{oops')).toBeNull()
    expect(parseDesignTokens('[]')).toBeNull()
    expect(parseDesignTokens('"x"')).toBeNull()
  })
})

describe('designTokenCssVar', () => {
  it('turns dots into dashes', () => {
    expect(designTokenCssVar('color.primary')).toBe('--color-primary')
    expect(designTokenCssVar('color.brand.primary')).toBe('--color-brand-primary')
  })

  it('keeps an odd name inside one safe identifier', () => {
    expect(designTokenCssVar('space.a b;}')).toBe('--space-a-b--')
  })
})
