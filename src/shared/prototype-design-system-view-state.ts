// The Design system view's own state, held per project in memory: its tab, its selection, the draft and
// the sends that carry it, and the controls around them. Each transition is a function of the state, so
// the screen renders what these return and nothing else decides.
import type { ComponentSection } from './prototype-design-system-components'
import {
  addDraftComponent,
  emptyDesignSystemDraft,
  type DesignSystemDraft
} from './prototype-design-system-draft'
import type { DesignSystemPalette } from './prototype-design-system-tokens'

export const DESIGN_SYSTEM_TABS = ['tokens', 'components', 'source'] as const

export type DesignSystemTab = (typeof DESIGN_SYSTEM_TABS)[number]

/** The component kinds the add panel offers, by English name; the draft names the one chosen. */
export const DESIGN_SYSTEM_ADD_CHOICES = [
  'Badge',
  'Modal',
  'Table',
  'Toast',
  'Avatar',
  'Toggle'
] as const

export type DesignSystemSelection =
  | { kind: 'token'; id: string }
  | { kind: 'component'; name: string }

/** The sends of the view: the draft, a re-detect, and a palette approval. */
export type DesignSystemSendKind = 'draft' | 'redetect' | 'palette'

export type DesignSystemViewState = {
  tab: DesignSystemTab
  /** The chosen token or component; null shows the system's first component. */
  selection: DesignSystemSelection | null
  draft: DesignSystemDraft
  /** Whether the draft also rebuilds the sets built on the current version. */
  rebuild: boolean
  freeText: string
  addOpen: boolean
  /** The kind chip the add panel has picked; a typed description wins over it. */
  addChoice: string
  addText: string
  /** The color picker of a token's custom swatch is open. */
  pickerOpen: boolean
  pickerHue: number
  /** The palette the review has picked; null takes the first. */
  palette: string | null
  sending: boolean
  /** The send that was refused, so its failure line shows where that send is. */
  failed: DesignSystemSendKind | null
}

export function emptyDesignSystemViewState(): DesignSystemViewState {
  return {
    tab: 'components',
    selection: null,
    draft: emptyDesignSystemDraft(),
    rebuild: true,
    freeText: '',
    addOpen: false,
    addChoice: DESIGN_SYSTEM_ADD_CHOICES[0],
    addText: '',
    pickerOpen: false,
    pickerHue: 0,
    palette: null,
    sending: false,
    failed: null
  }
}

export function isDesignSystemTab(value: string): value is DesignSystemTab {
  return DESIGN_SYSTEM_TABS.some((tab) => tab === value)
}

/** The selection the screen shows: the chosen item, else the first component, else none. */
export function effectiveSelectionOf(
  state: DesignSystemViewState,
  components: readonly ComponentSection[]
): DesignSystemSelection | null {
  if (state.selection !== null) {
    return state.selection
  }
  const first = components[0]
  return first === undefined ? null : { kind: 'component', name: first.name }
}

/** The palette the review shows as chosen: the one picked, else the first. */
export function chosenPaletteOf(
  state: DesignSystemViewState,
  palettes: readonly DesignSystemPalette[]
): DesignSystemPalette | null {
  return palettes.find((palette) => palette.id === state.palette) ?? palettes[0] ?? null
}

export function sendBegun(state: DesignSystemViewState): DesignSystemViewState {
  return { ...state, sending: true, failed: null }
}

/** A send the chat took: the draft is cleared, and the rebuild option goes back to its default. */
export function sendAccepted(
  state: DesignSystemViewState,
  kind: DesignSystemSendKind
): DesignSystemViewState {
  const settled = { ...state, sending: false, failed: null }
  return kind === 'draft'
    ? { ...settled, draft: emptyDesignSystemDraft(), freeText: '', rebuild: true }
    : settled
}

/** A refused send keeps the draft and the text exactly as they were. */
export function sendRefused(
  state: DesignSystemViewState,
  kind: DesignSystemSendKind
): DesignSystemViewState {
  return { ...state, sending: false, failed: kind }
}

export function chooseAddChoice(
  state: DesignSystemViewState,
  choice: string
): DesignSystemViewState {
  return { ...state, addChoice: choice, addText: '' }
}

/** Adds the typed description, or the chosen kind when nothing is typed, and closes the add panel. */
export function addComponentToDraft(state: DesignSystemViewState): DesignSystemViewState {
  const description = state.addText.trim() || state.addChoice
  return {
    ...state,
    draft: addDraftComponent(state.draft, description),
    addOpen: false,
    addText: ''
  }
}
