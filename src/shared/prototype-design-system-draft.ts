// The draft of a design system edit: every token, component and note the user changed, as the items
// that one message sends to the agent. Reverting a change removes its item.
import type { ComponentSection } from './prototype-design-system-components'
import type { DesignToken } from './prototype-design-system-tokens'

export const DESIGN_SYSTEM_TOKENS_GROUP_TITLE = 'Design system · tokens'
export const DESIGN_SYSTEM_COMPONENTS_GROUP_TITLE = 'Design system · components'

/** What the draft is measured against: the system as it is on disk. */
export type DesignSystemBase = {
  tokens: readonly DesignToken[]
  components: readonly ComponentSection[]
}

export type DesignSystemComponentDraft = {
  variants?: string[]
  bindings?: Record<string, string>
}

export type DesignSystemDraft = {
  /** Token id to the value the user set. */
  values: Record<string, string>
  /** Component name to its changed variants and bindings. */
  comps: Record<string, DesignSystemComponentDraft>
  /** Component name to the note the user wrote. */
  notes: Record<string, string>
  /** Names of the components marked for removal. */
  removed: Record<string, true>
  /** Components to add, as the user described them. */
  added: string[]
}

export type DesignSystemDraftItem = {
  /** The token's group for a token; `variant`, `binding`, `note`, `remove` or `add` for a component. */
  label: string
  text: string
}

export type DesignSystemDraftGroup = {
  title: string
  items: DesignSystemDraftItem[]
}

export function emptyDesignSystemDraft(): DesignSystemDraft {
  return { values: {}, comps: {}, notes: {}, removed: {}, added: [] }
}

/** The value a token has in the draft. */
export function draftTokenValue(draft: DesignSystemDraft, token: DesignToken): string {
  return (Object.hasOwn(draft.values, token.id) ? draft.values[token.id] : undefined) ?? token.value
}

/** Sets a token's value; the original value drops the change. */
export function setDraftTokenValue(
  draft: DesignSystemDraft,
  token: DesignToken,
  value: string
): DesignSystemDraft {
  const values = { ...draft.values }
  if (value === token.value) {
    delete values[token.id]
  } else {
    values[token.id] = value
  }
  return { ...draft, values }
}

/** The variants and bindings a component has in the draft. */
export function draftComponentState(
  draft: DesignSystemDraft,
  section: ComponentSection
): { variants: string[]; bindings: Record<string, string> } {
  const changes = ownEntry(draft.comps, section.name)
  return {
    variants: changes?.variants ?? section.variants,
    bindings: { ...section.bindings, ...changes?.bindings }
  }
}

/** Sets the variants a component shows; the original variants drop the change. */
export function setDraftVariants(
  draft: DesignSystemDraft,
  section: ComponentSection,
  variants: readonly string[]
): DesignSystemDraft {
  const { variants: _kept, ...rest } = ownEntry(draft.comps, section.name) ?? {}
  const changed = !sameList(variants, section.variants)
  return withComponentDraft(
    draft,
    section.name,
    changed ? { ...rest, variants: [...variants] } : rest
  )
}

/** Binds a property of a component to another token; the original token drops the change. */
export function setDraftBinding(
  draft: DesignSystemDraft,
  section: ComponentSection,
  prop: string,
  tokenId: string
): DesignSystemDraft {
  const { bindings, ...rest } = ownEntry(draft.comps, section.name) ?? {}
  const next = { ...bindings }
  if (section.bindings[prop] === tokenId) {
    delete next[prop]
  } else {
    next[prop] = tokenId
  }
  return withComponentDraft(
    draft,
    section.name,
    Object.keys(next).length > 0 ? { ...rest, bindings: next } : rest
  )
}

export function setDraftNote(
  draft: DesignSystemDraft,
  name: string,
  note: string
): DesignSystemDraft {
  const notes = { ...draft.notes }
  if (note.trim().length === 0) {
    delete notes[name]
  } else {
    notes[name] = note
  }
  return { ...draft, notes }
}

/** Marks a component for removal, or takes the mark back. */
export function toggleDraftRemoved(draft: DesignSystemDraft, name: string): DesignSystemDraft {
  const removed = { ...draft.removed }
  if (removed[name] === true) {
    delete removed[name]
  } else {
    removed[name] = true
  }
  return { ...draft, removed }
}

/** Adds a component to create; blank text adds nothing. */
export function addDraftComponent(draft: DesignSystemDraft, text: string): DesignSystemDraft {
  const description = text.trim()
  return description.length === 0 ? draft : { ...draft, added: [...draft.added, description] }
}

export function removeDraftAdded(draft: DesignSystemDraft, index: number): DesignSystemDraft {
  return { ...draft, added: draft.added.filter((_added, position) => position !== index) }
}

/** The draft's items in two groups, tokens then components; a group with no item is left out. */
export function designSystemDraftGroups(
  base: DesignSystemBase,
  draft: DesignSystemDraft
): DesignSystemDraftGroup[] {
  const tokenItems = tokenItemsOf(base.tokens, draft)
  const componentItems = [
    ...base.components.flatMap((section) => componentItemsOf(section, draft)),
    ...draft.added.map((text): DesignSystemDraftItem => ({
      label: 'add',
      text: `Add component: ${text}`
    }))
  ]
  return [
    ...(tokenItems.length > 0
      ? [{ title: DESIGN_SYSTEM_TOKENS_GROUP_TITLE, items: tokenItems }]
      : []),
    ...(componentItems.length > 0
      ? [{ title: DESIGN_SYSTEM_COMPONENTS_GROUP_TITLE, items: componentItems }]
      : [])
  ]
}

export function designSystemDraftCount(base: DesignSystemBase, draft: DesignSystemDraft): number {
  return designSystemDraftGroups(base, draft).reduce(
    (count, group) => count + group.items.length,
    0
  )
}

function tokenItemsOf(
  tokens: readonly DesignToken[],
  draft: DesignSystemDraft
): DesignSystemDraftItem[] {
  return tokens.flatMap((token) => {
    const value = draftTokenValue(draft, token)
    return value === token.value
      ? []
      : [{ label: token.group, text: `${token.id} ${token.value} → ${value}` }]
  })
}

function componentItemsOf(
  section: ComponentSection,
  draft: DesignSystemDraft
): DesignSystemDraftItem[] {
  const { name } = section
  if (draft.removed[name] === true) {
    return [{ label: 'remove', text: `Remove component: ${name}` }]
  }
  const now = draftComponentState(draft, section)
  const items: DesignSystemDraftItem[] = [
    ...now.variants
      .filter((variant) => !section.variants.includes(variant))
      .map((variant) => ({ label: 'variant', text: `${name}: add ${variant} state` })),
    ...section.variants
      .filter((variant) => !now.variants.includes(variant))
      .map((variant) => ({ label: 'variant', text: `${name}: drop ${variant} state` })),
    ...Object.entries(section.bindings).flatMap(([prop, tokenId]) =>
      now.bindings[prop] === tokenId
        ? []
        : [
            {
              label: 'binding',
              text: `${name} ${prop}: ${tokenId} → ${now.bindings[prop] ?? tokenId}`
            }
          ]
    )
  ]
  const note = (ownEntry(draft.notes, name) ?? '').trim()
  return note.length > 0 ? [...items, { label: 'note', text: `${name}: ${note}` }] : items
}

function withComponentDraft(
  draft: DesignSystemDraft,
  name: string,
  changes: DesignSystemComponentDraft
): DesignSystemDraft {
  const comps = { ...draft.comps }
  if (Object.keys(changes).length === 0) {
    delete comps[name]
  } else {
    comps[name] = changes
  }
  return { ...draft, comps }
}

// Names are file content: only an own entry counts, so `constructor` or `__proto__` read as absent.
function ownEntry<Value>(record: Readonly<Record<string, Value>>, name: string): Value | undefined {
  return Object.hasOwn(record, name) ? record[name] : undefined
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
