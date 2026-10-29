import { describe, expect, it } from 'vitest'
import type { ComponentSection } from './prototype-design-system-components'
import { emptyDesignSystemDraft, setDraftNote } from './prototype-design-system-draft'
import type { DesignSystemPalette } from './prototype-design-system-tokens'
import {
  addComponentToDraft,
  chooseAddChoice,
  chosenPaletteOf,
  effectiveSelectionOf,
  emptyDesignSystemViewState,
  isDesignSystemTab,
  sendAccepted,
  sendBegun,
  sendRefused
} from './prototype-design-system-view-state'

function component(name: string): ComponentSection {
  return { name, variants: ['default'], variantOptions: ['default'], bindings: {}, html: '' }
}

const PALETTES: DesignSystemPalette[] = [
  { id: 'A', name: 'Calm blue', note: 'Neutral grays', swatches: [], tokens: {} },
  { id: 'B', name: 'Warm clay', note: 'Off-white ground', swatches: [], tokens: {} }
]

describe('emptyDesignSystemViewState', () => {
  it('opens on the Components tab with nothing selected, the rebuild on and the Badge kind', () => {
    expect(emptyDesignSystemViewState()).toMatchObject({
      tab: 'components',
      selection: null,
      rebuild: true,
      freeText: '',
      addOpen: false,
      addChoice: 'Badge',
      sending: false,
      failed: null
    })
  })

  it('recognizes the three tabs and nothing else', () => {
    expect(['tokens', 'components', 'source'].every(isDesignSystemTab)).toBe(true)
    expect(isDesignSystemTab('palette')).toBe(false)
  })
})

describe('effectiveSelectionOf', () => {
  it('shows the first component until another item is chosen', () => {
    const components = [component('Button'), component('Input')]
    const state = emptyDesignSystemViewState()
    expect(effectiveSelectionOf(state, components)).toEqual({ kind: 'component', name: 'Button' })
    expect(
      effectiveSelectionOf({ ...state, selection: { kind: 'token', id: 'radius.md' } }, components)
    ).toEqual({ kind: 'token', id: 'radius.md' })
  })

  it('shows nothing for a system with no component and no choice', () => {
    expect(effectiveSelectionOf(emptyDesignSystemViewState(), [])).toBeNull()
  })
})

describe('chosenPaletteOf', () => {
  it('takes the palette picked, else the first one', () => {
    const state = emptyDesignSystemViewState()
    expect(chosenPaletteOf(state, PALETTES)?.name).toBe('Calm blue')
    expect(chosenPaletteOf({ ...state, palette: 'B' }, PALETTES)?.name).toBe('Warm clay')
    expect(chosenPaletteOf(state, [])).toBeNull()
  })
})

describe('sends', () => {
  const drafted = {
    ...emptyDesignSystemViewState(),
    tab: 'source' as const,
    selection: { kind: 'token' as const, id: 'radius.md' },
    draft: setDraftNote(emptyDesignSystemDraft(), 'Button', 'Pill buttons'),
    rebuild: false,
    freeText: 'Tone: calm'
  }

  it('clears the draft, its text and the rebuild option once the chat takes the draft', () => {
    const sent = sendAccepted(sendBegun(drafted), 'draft')
    expect(sent).toMatchObject({
      sending: false,
      failed: null,
      freeText: '',
      rebuild: true,
      tab: 'source',
      selection: { kind: 'token', id: 'radius.md' }
    })
    expect(sent.draft).toEqual(emptyDesignSystemDraft())
  })

  it('keeps the draft and names the refused send when the chat does not take it', () => {
    const refused = sendRefused(sendBegun(drafted), 'draft')
    expect(refused).toMatchObject({ sending: false, failed: 'draft', freeText: 'Tone: calm' })
    expect(refused.draft).toEqual(drafted.draft)
  })

  it('leaves the draft alone when a re-detect or a palette approval is taken', () => {
    expect(sendAccepted(sendBegun(drafted), 'redetect').draft).toEqual(drafted.draft)
    expect(sendAccepted(sendBegun(drafted), 'palette').freeText).toBe('Tone: calm')
  })

  it('clears the earlier failure when a new send starts', () => {
    expect(sendBegun(sendRefused(drafted, 'draft'))).toMatchObject({
      sending: true,
      failed: null
    })
  })
})

describe('the add panel', () => {
  it('picks a kind and drops the typed text', () => {
    const typed = { ...emptyDesignSystemViewState(), addText: 'A stepper' }
    expect(chooseAddChoice(typed, 'Modal')).toMatchObject({ addChoice: 'Modal', addText: '' })
  })

  it('adds the typed description, else the chosen kind, and closes the panel', () => {
    const open = { ...emptyDesignSystemViewState(), addOpen: true }
    const described = addComponentToDraft({ ...open, addText: '  phase stepper  ' })
    expect(described).toMatchObject({ addOpen: false, addText: '' })
    expect(described.draft.added).toEqual(['phase stepper'])
    const chosen = addComponentToDraft({ ...open, addChoice: 'Toast', addText: '   ' })
    expect(chosen.draft.added).toEqual(['Toast'])
  })
})
