import { describe, expect, it } from 'vitest'
import type { ComponentSection } from './prototype-design-system-components'
import {
  addDraftComponent,
  designSystemDraftCount,
  designSystemDraftGroups,
  draftComponentState,
  draftTokenValue,
  emptyDesignSystemDraft,
  removeDraftAdded,
  setDraftBinding,
  setDraftNote,
  setDraftTokenValue,
  setDraftVariants,
  toggleDraftRemoved,
  type DesignSystemBase
} from './prototype-design-system-draft'
import type { DesignToken } from './prototype-design-system-tokens'

function token(id: string, value: string): DesignToken {
  const [group = '', name = ''] = id.split('.')
  return { id, group, name, type: group, value }
}

const PRIMARY = token('color.primary', '#2563eb')
const MD = token('radius.md', '8px')

function section(
  name: string,
  variants: string[],
  bindings: Record<string, string>
): ComponentSection {
  return { name, variants, variantOptions: [...variants, 'hover'], bindings, html: '' }
}

const BUTTON = section('Button', ['primary', 'secondary', 'disabled'], {
  background: 'color.primary',
  radius: 'radius.md'
})
const TABS = section('Tabs', ['default', 'active'], { indicator: 'color.primary' })

const BASE: DesignSystemBase = { tokens: [PRIMARY, MD], components: [BUTTON, TABS] }

describe('design system draft', () => {
  it('has no items when nothing changed', () => {
    const draft = emptyDesignSystemDraft()
    expect(designSystemDraftGroups(BASE, draft)).toEqual([])
    expect(designSystemDraftCount(BASE, draft)).toBe(0)
  })

  it('lists a changed token under its group and takes it back on revert', () => {
    const changed = setDraftTokenValue(emptyDesignSystemDraft(), PRIMARY, '#1d4ed8')
    expect(draftTokenValue(changed, PRIMARY)).toBe('#1d4ed8')
    expect(designSystemDraftGroups(BASE, changed)).toEqual([
      {
        title: 'Design system · tokens',
        items: [{ label: 'color', text: 'color.primary #2563eb → #1d4ed8' }]
      }
    ])
    const reverted = setDraftTokenValue(changed, PRIMARY, '#2563eb')
    expect(reverted.values).toEqual({})
    expect(designSystemDraftCount(BASE, reverted)).toBe(0)
  })

  it('lists variant additions and drops, in that order', () => {
    const draft = setDraftVariants(emptyDesignSystemDraft(), BUTTON, [
      'primary',
      'disabled',
      'hover'
    ])
    expect(draftComponentState(draft, BUTTON).variants).toEqual(['primary', 'disabled', 'hover'])
    expect(designSystemDraftGroups(BASE, draft)[0]?.items).toEqual([
      { label: 'variant', text: 'Button: add hover state' },
      { label: 'variant', text: 'Button: drop secondary state' }
    ])
  })

  it('lists a changed binding and takes it back on revert', () => {
    const changed = setDraftBinding(
      emptyDesignSystemDraft(),
      BUTTON,
      'background',
      'color.foreground'
    )
    expect(draftComponentState(changed, BUTTON).bindings).toEqual({
      background: 'color.foreground',
      radius: 'radius.md'
    })
    expect(designSystemDraftGroups(BASE, changed)[0]).toEqual({
      title: 'Design system · components',
      items: [{ label: 'binding', text: 'Button background: color.primary → color.foreground' }]
    })
    const reverted = setDraftBinding(changed, BUTTON, 'background', 'color.primary')
    expect(reverted.comps).toEqual({})
    expect(designSystemDraftCount(BASE, reverted)).toBe(0)
  })

  it('reverting variants keeps a binding change', () => {
    let draft = setDraftBinding(emptyDesignSystemDraft(), BUTTON, 'radius', 'radius.lg')
    draft = setDraftVariants(draft, BUTTON, ['primary'])
    draft = setDraftVariants(draft, BUTTON, BUTTON.variants)
    expect(draft.comps['Button']).toEqual({ bindings: { radius: 'radius.lg' } })
  })

  it('lists a trimmed note and drops a blank one', () => {
    const noted = setDraftNote(emptyDesignSystemDraft(), 'Button', '  Heavier on dark.  ')
    expect(designSystemDraftGroups(BASE, noted)[0]?.items).toEqual([
      { label: 'note', text: 'Button: Heavier on dark.' }
    ])
    expect(setDraftNote(noted, 'Button', '   ').notes).toEqual({})
  })

  it('lists a removed component alone and takes the mark back', () => {
    let draft = setDraftVariants(emptyDesignSystemDraft(), TABS, ['default'])
    draft = setDraftNote(draft, 'Tabs', 'a note')
    draft = toggleDraftRemoved(draft, 'Tabs')
    expect(designSystemDraftGroups(BASE, draft)[0]?.items).toEqual([
      { label: 'remove', text: 'Remove component: Tabs' }
    ])
    draft = toggleDraftRemoved(draft, 'Tabs')
    expect(designSystemDraftGroups(BASE, draft)[0]?.items.map((item) => item.label)).toEqual([
      'variant',
      'note'
    ])
  })

  it('lists added components after the changed ones and removes them again', () => {
    let draft = addDraftComponent(emptyDesignSystemDraft(), '  Badge  ')
    draft = addDraftComponent(draft, '   ')
    draft = setDraftNote(draft, 'Button', 'n')
    expect(draft.added).toEqual(['Badge'])
    expect(designSystemDraftGroups(BASE, draft)[0]?.items).toEqual([
      { label: 'note', text: 'Button: n' },
      { label: 'add', text: 'Add component: Badge' }
    ])
    expect(removeDraftAdded(draft, 0).added).toEqual([])
  })

  it('groups tokens before components and counts every item', () => {
    let draft = setDraftTokenValue(emptyDesignSystemDraft(), MD, '10px')
    draft = setDraftTokenValue(draft, PRIMARY, '#000')
    draft = addDraftComponent(draft, 'Badge')
    expect(designSystemDraftGroups(BASE, draft).map((group) => group.title)).toEqual([
      'Design system · tokens',
      'Design system · components'
    ])
    expect(designSystemDraftCount(BASE, draft)).toBe(3)
  })

  it('ignores a change to something the system no longer has', () => {
    let draft = setDraftTokenValue(emptyDesignSystemDraft(), token('color.gone', '#fff'), '#000')
    draft = setDraftNote(draft, 'Gone', 'x')
    expect(designSystemDraftCount(BASE, draft)).toBe(0)
  })

  it('does not change the draft it is given', () => {
    const before = emptyDesignSystemDraft()
    setDraftTokenValue(before, PRIMARY, '#000')
    setDraftNote(before, 'Button', 'x')
    toggleDraftRemoved(before, 'Button')
    expect(before).toEqual(emptyDesignSystemDraft())
  })
})
