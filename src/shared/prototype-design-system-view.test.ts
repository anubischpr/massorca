import { describe, expect, it } from 'vitest'
import type { ComponentSection } from './prototype-design-system-components'
import {
  componentsUsingToken,
  designSystemDayLabel,
  designSystemSectionsOf,
  designSystemTargetSet,
  joinParts,
  paletteTypeParts,
  previousVersionOf,
  sampleTextOf,
  setsBuiltOn,
  spacingBarPixels,
  tokenGroupOf
} from './prototype-design-system-view'
import type { DesignToken } from './prototype-design-system-tokens'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'

function token(
  id: string,
  value: string,
  extra: { type?: string; description?: string; weight?: number } = {}
): DesignToken {
  const [group = '', ...rest] = id.split('.')
  return {
    id,
    group,
    name: rest.join('.'),
    type: extra.type ?? group,
    value,
    ...(extra.description === undefined ? {} : { description: extra.description }),
    ...(extra.weight === undefined ? {} : { weight: extra.weight })
  }
}

function component(name: string, bindings: Record<string, string>): ComponentSection {
  return { name, variants: ['default'], variantOptions: ['default'], bindings, html: '' }
}

function set(
  requestId: string,
  projectKey: string | undefined,
  builtOn?: number,
  folderPath?: string
): PrototypeListedSet {
  return {
    requestId,
    sessionId: 'session-alpha-0001',
    agent: 'codex',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'a checkout page',
    createdAt: '2026-10-28T20:15:00.000Z',
    count: 2,
    directions: [],
    ...(projectKey === undefined ? {} : { projectKey, projectName: 'nexuscare' }),
    ...(builtOn === undefined ? {} : { builtOn }),
    ...(folderPath === undefined ? {} : { folderPath })
  }
}

describe('designSystemSectionsOf', () => {
  it('groups the tokens by section and finds the font family by its W3C type', () => {
    const tokens = [
      token('color.primary', '#2563eb'),
      token('type.family', 'Geist', { type: 'fontFamily' }),
      token('type.body', '14px', { description: 'Body text', weight: 400 }),
      token('space.1', '4px'),
      token('radius.md', '8px')
    ]
    const sections = designSystemSectionsOf(tokens)
    expect(sections.color.map((entry) => entry.id)).toEqual(['color.primary'])
    expect(sections.type.map((entry) => entry.id)).toEqual(['type.family', 'type.body'])
    expect(sections.typeScale.map((entry) => entry.id)).toEqual(['type.body'])
    expect(sections.fontFamily).toBe('Geist')
    expect(sections.space).toHaveLength(1)
    expect(sections.radius).toHaveLength(1)
    expect(sections.shadow).toEqual([])
    expect(sections.motion).toEqual([])
  })

  it('reads no font family when the system has none', () => {
    expect(designSystemSectionsOf([token('type.body', '14px')]).fontFamily).toBeNull()
  })
})

describe('sampleTextOf and spacingBarPixels', () => {
  it('shows the description of a type token, else its name capitalized', () => {
    expect(sampleTextOf(token('type.body', '14px', { description: 'Body copy' }))).toBe('Body copy')
    expect(sampleTextOf(token('type.display', '32px'))).toBe('Display')
  })

  it('draws a space bar four pixels per unit, and none for a value without a number', () => {
    expect(spacingBarPixels('4px')).toBe(16)
    expect(spacingBarPixels('0.5rem')).toBe(2)
    expect(spacingBarPixels('auto')).toBe(0)
  })
})

describe('usage', () => {
  it('counts the components whose bindings name the token', () => {
    const components = [
      component('Button', { background: 'color.primary', radius: 'radius.md' }),
      component('Tabs', { indicator: 'color.primary' }),
      component('Card', { background: 'color.background' })
    ]
    expect(componentsUsingToken('color.primary', components)).toBe(2)
    expect(componentsUsingToken('space.1', components)).toBe(0)
  })

  it('takes the sets a rebuild offers from the project’s sets built on the current version', () => {
    const sets = [
      set('r1', 'nexus', 2, '/state/r1'),
      set('r2', 'nexus', 1, '/state/r2'),
      set('r3', 'landing', 2, '/state/r3'),
      set('r4', 'nexus', 2)
    ]
    expect(setsBuiltOn(sets, 'nexus', 2).map((listed) => listed.requestId)).toEqual(['r1'])
  })

  it('sends a design system message to the newest set of its project', () => {
    const sets = [set('r3', 'landing'), set('r2', 'nexus'), set('r1', 'nexus')]
    expect(designSystemTargetSet(sets, 'nexus')?.requestId).toBe('r2')
    expect(designSystemTargetSet(sets, 'missing')).toBeUndefined()
  })

  it('reads the group of a bound token from its id', () => {
    expect(tokenGroupOf('radius.md')).toBe('radius')
  })
})

describe('previousVersionOf and designSystemDayLabel', () => {
  it('reads the newest history entry older than the current version', () => {
    const history = [
      { version: 1, status: 'detected' as const, at: '2026-10-21' },
      { version: 2, status: 'proposed' as const, at: '2026-10-25' },
      { version: 4, status: 'detected' as const, at: '2026-10-29' }
    ]
    expect(previousVersionOf(history, 5)).toEqual(history[2])
    expect(previousVersionOf(history, 2)).toEqual(history[0])
    expect(previousVersionOf([], 2)).toBeNull()
  })

  it('shows a day as "21 Oct" in the locale, and nothing for text that is not a date', () => {
    expect(designSystemDayLabel('2026-10-21', 'en-GB')).toBe('21 Oct')
    expect(designSystemDayLabel('21/10/2026', 'en-GB')).toBeNull()
    expect(designSystemDayLabel(undefined, 'en-GB')).toBeNull()
  })
})

describe('paletteTypeParts', () => {
  it('reads the font, the numeric type sizes, the medium radius and the spacing base', () => {
    const sections = designSystemSectionsOf([
      token('type.family', 'Geist', { type: 'fontFamily' }),
      token('type.display', '32px'),
      token('type.title', '20px'),
      token('type.body', '14px'),
      token('type.caption', '12px'),
      token('type.weight', 'bold'),
      token('radius.md', '8px'),
      token('space.1', '4px')
    ])
    expect(paletteTypeParts(sections)).toEqual({
      fontFamily: 'Geist',
      sizes: ['32', '20', '14', '12'],
      radius: '8',
      spacingBase: '4'
    })
  })

  it('leaves out what the system does not have', () => {
    expect(paletteTypeParts(designSystemSectionsOf([]))).toEqual({
      fontFamily: null,
      sizes: [],
      radius: null,
      spacingBase: null
    })
  })
})

describe('joinParts', () => {
  it('joins the parts that are present and leaves out the missing and empty ones', () => {
    expect(joinParts(['v2', null, undefined, '', 'Codex'])).toBe('v2 · Codex')
    expect(joinParts(['v1 was', 'detected'], ' ')).toBe('v1 was detected')
    expect(joinParts([null])).toBe('')
  })
})
