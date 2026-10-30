import { describe, expect, it } from 'vitest'
import {
  emptyDesignSystemDraft,
  setDraftBinding,
  setDraftVariants,
  toggleDraftRemoved
} from '../../../src/shared/prototype-design-system-draft'
import {
  mobileBindingLabel,
  mobileColorBindings,
  mobileColorTokens,
  mobileComponentMeta,
  mobileDesignSystemSubtitle,
  mobileTokenSummaryLines
} from './mobile-prototype-design-system-model'
import { nexusContent } from './mobile-prototype-design-system.test-fixture'

describe('mobileDesignSystemSubtitle', () => {
  it('reads project, version and agent', () => {
    expect(mobileDesignSystemSubtitle('nexuscare', 2, 'Codex')).toBe('nexuscare · v2 · Codex')
  })

  it('leaves out an agent the system does not name', () => {
    expect(mobileDesignSystemSubtitle('nexuscare', 2, undefined)).toBe('nexuscare · v2')
  })
})

describe('mobileTokenSummaryLines', () => {
  it('summarizes type, space and radius like the board', () => {
    expect(mobileTokenSummaryLines(nexusContent().tokens)).toEqual([
      'type.display 32/600 · title 20/600 · body 14/400',
      'space 4 · 8 · 12',
      'radius sm 6 · md 10'
    ])
  })

  it('leaves out a line with no tokens', () => {
    const colorsOnly = nexusContent().tokens.filter((token) => token.group === 'color')
    expect(mobileTokenSummaryLines(colorsOnly)).toEqual([])
    const noSpace = nexusContent().tokens.filter((token) => token.group !== 'space')
    expect(mobileTokenSummaryLines(noSpace)).toEqual([
      'type.display 32/600 · title 20/600 · body 14/400',
      'radius sm 6 · md 10'
    ])
  })
})

describe('component rows', () => {
  const [button, input] = nexusContent().components

  it('shows the variants the draft leaves, joined by a dot', () => {
    expect(button && mobileComponentMeta(button, emptyDesignSystemDraft())).toBe(
      'primary · secondary'
    )
    const withHover =
      button && setDraftVariants(emptyDesignSystemDraft(), button, ['primary', 'hover'])
    expect(button && withHover && mobileComponentMeta(button, withHover)).toBe('primary · hover')
  })

  it('says a removed component is marked for removal', () => {
    const removed = toggleDraftRemoved(emptyDesignSystemDraft(), 'Input')
    expect(input && mobileComponentMeta(input, removed)).toBe('marked for removal · in the draft')
  })
})

describe('component color bindings', () => {
  const [button] = nexusContent().components

  it('lists only the bindings to a color token, labelled "{Prop} token"', () => {
    expect(button && mobileColorBindings(button, emptyDesignSystemDraft())).toEqual([
      { prop: 'background', boundTo: 'color.primary' }
    ])
    expect(mobileBindingLabel('background')).toBe('Background token')
  })

  it('follows a binding the draft changed, and offers the color tokens', () => {
    const draft =
      button && setDraftBinding(emptyDesignSystemDraft(), button, 'background', 'color.muted')
    expect(button && draft && mobileColorBindings(button, draft)).toEqual([
      { prop: 'background', boundTo: 'color.muted' }
    ])
    expect(mobileColorTokens(nexusContent()).map((token) => token.id)).toEqual([
      'color.primary',
      'color.background',
      'color.foreground',
      'color.muted'
    ])
  })
})
