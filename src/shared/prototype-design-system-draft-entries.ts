// The draft's own-entry reads and the component entry writes, shared by the draft and its element edits.
import type { DesignSystemComponentDraft, DesignSystemDraft } from './prototype-design-system-draft'

export function withComponentDraft(
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
export function ownEntry<Value>(
  record: Readonly<Record<string, Value>>,
  name: string
): Value | undefined {
  return Object.hasOwn(record, name) ? record[name] : undefined
}

export function isRecord<Value = unknown>(value: unknown): value is Record<string, Value> {
  return typeof value === 'object' && value !== null
}
