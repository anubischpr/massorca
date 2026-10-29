// The auto-draft of an iteration: the fields changed on each pin and the notes taken on any
// direction, grouped by pin, and the message that sends them back to the chat.

export type PrototypeSize = {
  value: number
  unit: 'px' | '%' | 'auto'
}

export type PrototypeElementState = {
  text: string
  color: string
  bg: string
  width: PrototypeSize
  height: PrototypeSize
  fontSize: number
}

export type PrototypePin = {
  pinKey: string
  number: number
  label: string
  selector: string
  htmlSnippet?: string
  original: PrototypeElementState
  current: PrototypeElementState
}

// Keyed `${letter}:${pinKey}`. A note may sit on any direction, not only the one being iterated.
export type PrototypeNotes = Readonly<Record<string, string>>

export type PrototypeDraftField = 'text' | 'color' | 'bg' | 'width' | 'height' | 'fontSize' | 'note'

export type PrototypeDraftItem = {
  field: PrototypeDraftField
  label: string
  value: string
  pinKey: string
  letter: string
}

export type PrototypeDraftGroup = {
  title: string
  pinKey: string
  items: PrototypeDraftItem[]
}

export type PrototypeDraft = {
  groups: PrototypeDraftGroup[]
  itemCount: number
}

export function buildDraft({
  activeLetter,
  pins,
  notes
}: {
  activeLetter: string
  pins: readonly PrototypePin[]
  notes: PrototypeNotes
}): PrototypeDraft {
  const groups: PrototypeDraftGroup[] = []
  for (const pin of pins) {
    const items = pinItems(activeLetter, pin, notes[`${activeLetter}:${pin.pinKey}`])
    if (items.length > 0) {
      groups.push({
        title: `${activeLetter} · ${pin.number} · ${pin.label}`,
        pinKey: pin.pinKey,
        items
      })
    }
  }
  groups.push(...siblingNoteGroups(activeLetter, pins, notes))
  const itemCount = groups.reduce((count, group) => count + group.items.length, 0)
  return { groups, itemCount }
}

/** Items for the fields that differ from the original, then the trimmed note when it has text. */
function pinItems(
  activeLetter: string,
  pin: PrototypePin,
  note: string | undefined
): PrototypeDraftItem[] {
  const { original, current } = pin
  const items: PrototypeDraftItem[] = []
  const add = (field: PrototypeDraftField, label: string, value: string): void => {
    items.push({ field, label, value, pinKey: pin.pinKey, letter: activeLetter })
  }
  if (current.text !== original.text) {
    add('text', 'text', `“${original.text}” → “${current.text}”`)
  }
  if (current.color !== original.color) {
    add('color', 'text color', `${original.color} → ${current.color}`)
  }
  if (current.bg !== original.bg) {
    add('bg', 'fill', `${original.bg} → ${current.bg}`)
  }
  if (!isSameSize(original.width, current.width)) {
    add('width', 'width', `${formatSize(original.width)} → ${formatSize(current.width)}`)
  }
  if (!isSameSize(original.height, current.height)) {
    add('height', 'height', `${formatSize(original.height)} → ${formatSize(current.height)}`)
  }
  if (current.fontSize !== original.fontSize) {
    add('fontSize', 'font size', `${original.fontSize}px → ${current.fontSize}px`)
  }
  const trimmedNote = note?.trim() ?? ''
  if (trimmedNote.length > 0) {
    add('note', 'note', trimmedNote)
  }
  return items
}

// A size is equal by unit; with `auto` the number does not apply.
function isSameSize(left: PrototypeSize, right: PrototypeSize): boolean {
  return left.unit === right.unit && (left.unit === 'auto' || left.value === right.value)
}

function formatSize(size: PrototypeSize): string {
  return size.unit === 'auto' ? 'auto' : `${size.value}${size.unit}`
}

type SiblingNote = {
  letter: string
  pinKey: string
  note: string
  order: number
}

// Notes taken on other directions, by letter, then by where their pin sits in the active list.
function siblingNoteGroups(
  activeLetter: string,
  pins: readonly PrototypePin[],
  notes: PrototypeNotes
): PrototypeDraftGroup[] {
  const siblings: SiblingNote[] = []
  for (const [key, text] of Object.entries(notes)) {
    const separator = key.indexOf(':')
    const letter = key.slice(0, separator)
    const note = text.trim()
    if (separator === -1 || letter === activeLetter || note.length === 0) {
      continue
    }
    const pinKey = key.slice(separator + 1)
    const index = pins.findIndex((candidate) => candidate.pinKey === pinKey)
    siblings.push({ letter, pinKey, note, order: index === -1 ? pins.length : index })
  }
  return siblings.sort(compareSiblings).map((sibling) => siblingGroup(activeLetter, pins, sibling))
}

function compareSiblings(left: SiblingNote, right: SiblingNote): number {
  return (
    compareText(left.letter, right.letter) ||
    left.order - right.order ||
    compareText(left.pinKey, right.pinKey)
  )
}

function compareText(left: string, right: string): number {
  if (left === right) {
    return 0
  }
  return left < right ? -1 : 1
}

// A sibling note keeps its own letter; its pin's number and label come from the active list when
// that list has the same pin, and otherwise the title falls back to the pin key.
function siblingGroup(
  activeLetter: string,
  pins: readonly PrototypePin[],
  sibling: SiblingNote
): PrototypeDraftGroup {
  const { letter, pinKey, note } = sibling
  const pin = pins.find((candidate) => candidate.pinKey === pinKey)
  const origin =
    pin === undefined ? `${letter} · ${pinKey}` : `${letter} · ${pin.number} · ${pin.label}`
  return {
    title: `from ${origin}`,
    pinKey,
    items: [{ field: 'note', label: `take into ${activeLetter}`, value: note, pinKey, letter }]
  }
}

export function composeIterationMessage({
  activeLetter,
  groups,
  pins,
  prompt
}: {
  activeLetter: string
  groups: readonly PrototypeDraftGroup[]
  pins: readonly PrototypePin[]
  prompt: string
}): string {
  const lines = [`Iterate on ${activeLetter}.`]
  for (const group of groups) {
    const selector = pins.find((pin) => pin.pinKey === group.pinKey)?.selector ?? ''
    lines.push(selector.length > 0 ? `${group.title} (${selector})` : group.title)
    for (const item of group.items) {
      lines.push(`  ${item.label}: ${singleLine(item.value)}`)
    }
  }
  const freeText = prompt.trim()
  if (freeText.length > 0) {
    lines.push('', freeText)
  }
  return lines.join('\n')
}

// Each item stays on one line, so a multi-line note cannot break the indented layout.
function singleLine(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ')
}
