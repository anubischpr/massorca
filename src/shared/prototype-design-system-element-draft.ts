// The element edits a component's draft holds: each picked element by its locator, with its changed values
// and its note. A value back at its original drops out, and an older draft reads as having none.
import type { ComponentSection } from './prototype-design-system-components'
import type { DesignSystemDraft } from './prototype-design-system-draft'
import { isRecord, ownEntry, withComponentDraft } from './prototype-design-system-draft-entries'
import { sameDesignValue, type DesignElementEdit } from './prototype-design-system-element'

/** One element of a component the user edited: its label when picked, its changed values and its note. */
export type DesignElementDraft = {
  label: string
  edits: DesignElementEdit
  note?: string
}

/** The element's draft entry, if the draft holds one; an entry of another shape reads as none. */
export function draftElementOf(
  draft: DesignSystemDraft,
  section: ComponentSection,
  locator: string
): DesignElementDraft | undefined {
  const entry = ownEntry(draftElementsOf(draft, section), locator)
  return entry !== undefined && typeof entry.label === 'string' && isRecord(entry.edits)
    ? entry
    : undefined
}

/** The element's edits in the draft; none when the draft holds no edit for it. */
export function draftElementEdits(
  draft: DesignSystemDraft,
  section: ComponentSection,
  locator: string
): DesignElementEdit {
  return draftElementOf(draft, section, locator)?.edits ?? {}
}

/**
 * Sets one value of an element. The value back at its original drops the edit; an element left with no
 * edit and no note drops out of the draft.
 */
export function setDraftElementValue<Prop extends keyof DesignElementEdit>(
  draft: DesignSystemDraft,
  section: ComponentSection,
  locator: string,
  label: string,
  prop: Prop,
  value: DesignElementEdit[Prop],
  original: DesignElementEdit[Prop]
): DesignSystemDraft {
  const current = draftElementOf(draft, section, locator)
  const edits: DesignElementEdit = { ...current?.edits }
  if (sameDesignValue(value, original)) {
    delete edits[prop]
  } else {
    edits[prop] = value
  }
  return withElementDraft(draft, section, locator, elementEntry(label, edits, current?.note))
}

/** Sets an element's note; a blank note drops out. */
export function setDraftElementNote(
  draft: DesignSystemDraft,
  section: ComponentSection,
  locator: string,
  label: string,
  note: string
): DesignSystemDraft {
  const current = draftElementOf(draft, section, locator)
  return withElementDraft(
    draft,
    section,
    locator,
    elementEntry(label, current?.edits ?? {}, note.trim().length === 0 ? undefined : note)
  )
}

function elementEntry(
  label: string,
  edits: DesignElementEdit,
  note: string | undefined
): DesignElementDraft | null {
  if (Object.keys(edits).length === 0 && note === undefined) {
    return null
  }
  return note === undefined ? { label, edits } : { label, edits, note }
}

function withElementDraft(
  draft: DesignSystemDraft,
  section: ComponentSection,
  locator: string,
  entry: DesignElementDraft | null
): DesignSystemDraft {
  const elements = { ...draftElementsOf(draft, section) }
  if (entry === null) {
    delete elements[locator]
  } else {
    elements[locator] = entry
  }
  const { elements: _kept, ...rest } = ownEntry(draft.comps, section.name) ?? {}
  return withComponentDraft(
    draft,
    section.name,
    Object.keys(elements).length > 0 ? { ...rest, elements } : rest
  )
}

// An older draft has no elements, and a malformed one reads as none: the draft never throws on them.
export function draftElementsOf(
  draft: DesignSystemDraft,
  section: ComponentSection
): Record<string, DesignElementDraft> {
  const elements: unknown = ownEntry(draft.comps, section.name)?.elements
  return isRecord<DesignElementDraft>(elements) ? elements : {}
}
