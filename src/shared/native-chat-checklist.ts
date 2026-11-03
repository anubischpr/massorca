// The shared checklist of a native chat. The agent writes it as a fenced block in a reply:
//
//   ```orca-checklist
//   title: QA preview pv27
//   - [ ] Chat summary opens from the ⋯ menu
//   - [x] Plan card shows progress
//   ```
//
// The person's checks, notes and screenshots live on the host (`agentSessionChecklist.*`), keyed by
// item text, and reach the agent as one `<orca-checklist-update>` block on the person's next send.

export const NATIVE_CHAT_CHECKLIST_FENCE_INFO = 'orca-checklist'
export const NATIVE_CHAT_CHECKLIST_MAX_ITEMS = 100
export const NATIVE_CHAT_CHECKLIST_ITEM_MAX_LENGTH = 500
export const NATIVE_CHAT_CHECKLIST_TITLE_MAX_LENGTH = 120
export const NATIVE_CHAT_CHECKLIST_NOTE_MAX_LENGTH = 2000
export const NATIVE_CHAT_CHECKLIST_MAX_SCREENSHOTS = 4

const UPDATE_OPEN = '<orca-checklist-update>'
const UPDATE_CLOSE = '</orca-checklist-update>'

export type NativeChatChecklistBlockItem = { text: string; checked: boolean }
export type NativeChatChecklistBlock = {
  title: string | null
  items: NativeChatChecklistBlockItem[]
}

/** One screenshot the person attached, stored on the host that owns the chat. */
export type NativeChatChecklistScreenshot = { path: string; name: string }

/** What the person set on one item; absent fields were never set by the person. */
export type NativeChatChecklistMark = {
  text: string
  checked?: boolean
  checkedAt?: number
  note?: string
  screenshots?: NativeChatChecklistScreenshot[]
  noteAt?: number
  /** The person added this item themselves; it is listed after the agent's items. */
  addedAt?: number
  /** The person removed an item they had added. */
  removed?: boolean
  /** Store revision of the last change, so the host can tell what the agent has not seen. */
  revision: number
}

/** The host's per-chat record of the person's marks. */
export type NativeChatChecklistPersonState = {
  revision: number
  /** Revision already sent to the agent. */
  deliveredRevision: number
  title: string | null
  marks: Record<string, NativeChatChecklistMark>
}

export type NativeChatChecklistItem = {
  key: string
  text: string
  /** Who wrote the item: the agent's block, or the person's own addition. */
  source: 'agent' | 'person'
  checked: boolean
  /** Who set the shown state; null for an item nobody has checked or unchecked. */
  by: 'agent' | 'person' | null
  at: number | null
  note: string | null
  noteAt: number | null
  screenshots: NativeChatChecklistScreenshot[]
  /** The person changed it after the agent last read the list. */
  unseen: boolean
}

export type NativeChatChecklist = {
  title: string | null
  items: NativeChatChecklistItem[]
  checked: number
  /** Person changes the agent has not seen yet. */
  unseen: number
}

/** One reply's checklist blocks, in order, as the agent wrote them. */
export type NativeChatChecklistReply = { at: number; markdown: string }

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/
const ITEM_LINE = /^[ \t]{0,3}[-*+][ \t]+\[([ xX])\][ \t]+(.+?)[ \t]*$/
const TITLE_LINE = /^[ \t]*title:[ \t]*(.+?)[ \t]*$/i

/** Stable identity for an item across the agent's rewrites: case and spacing do not matter. */
export function nativeChatChecklistItemKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text
}

function parseBlockBody(lines: string[]): NativeChatChecklistBlock {
  let title: string | null = null
  const items: NativeChatChecklistBlockItem[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const item = ITEM_LINE.exec(line)
    if (item) {
      const text = clip(item[2].trim(), NATIVE_CHAT_CHECKLIST_ITEM_MAX_LENGTH)
      const key = nativeChatChecklistItemKey(text)
      if (!seen.has(key) && items.length < NATIVE_CHAT_CHECKLIST_MAX_ITEMS) {
        seen.add(key)
        items.push({ text, checked: item[1] !== ' ' })
      }
      continue
    }
    const heading = title === null && items.length === 0 ? TITLE_LINE.exec(line) : null
    if (heading) {
      title = clip(heading[1], NATIVE_CHAT_CHECKLIST_TITLE_MAX_LENGTH)
    }
  }
  return { title, items }
}

/** The `orca-checklist` blocks in one reply, in order; an unclosed block counts once complete. */
export function nativeChatChecklistBlocksInReply(markdown: string): NativeChatChecklistBlock[] {
  if (!markdown.includes(NATIVE_CHAT_CHECKLIST_FENCE_INFO)) {
    return []
  }
  const blocks: NativeChatChecklistBlock[] = []
  let fence: { marker: string; checklist: boolean; body: string[] } | null = null
  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (fence) {
      const closer = FENCE_CLOSE.exec(line)?.[1]
      if (closer && closer[0] === fence.marker[0] && closer.length >= fence.marker.length) {
        if (fence.checklist) {
          blocks.push(parseBlockBody(fence.body))
        }
        fence = null
      } else if (fence.checklist) {
        fence.body.push(line)
      }
      continue
    }
    const opener = FENCE_OPEN.exec(line)
    if (opener) {
      fence = {
        marker: opener[1],
        checklist: opener[2] === NATIVE_CHAT_CHECKLIST_FENCE_INFO,
        body: []
      }
    }
  }
  return blocks
}

/**
 * The chat's checklist: the latest block's items, each with the latest of the agent's state (from
 * the reply that last changed it) and the person's mark, then the items the person added. Null
 * until the agent writes a block or the person adds an item.
 */
export function nativeChatChecklist(
  replies: readonly NativeChatChecklistReply[],
  person: NativeChatChecklistPersonState | null
): NativeChatChecklist | null {
  let latest: NativeChatChecklistBlock | null = null
  // A rewrite without a title line keeps the last one the agent gave.
  let title: string | null = null
  // When the agent last changed each item; `changed` is false while it only ever listed it.
  const agentChange = new Map<string, { checked: boolean; at: number; changed: boolean }>()
  for (const reply of replies) {
    for (const block of nativeChatChecklistBlocksInReply(reply.markdown)) {
      latest = block
      title = block.title ?? title
      for (const item of block.items) {
        const key = nativeChatChecklistItemKey(item.text)
        const previous = agentChange.get(key)
        if (!previous) {
          agentChange.set(key, { checked: item.checked, at: reply.at, changed: item.checked })
        } else if (previous.checked !== item.checked) {
          agentChange.set(key, { checked: item.checked, at: reply.at, changed: true })
        }
      }
    }
  }
  const added = Object.entries(person?.marks ?? {})
    .filter(([key, mark]) => mark.addedAt !== undefined && !mark.removed && !agentChange.has(key))
    .sort(([, left], [, right]) => (left.addedAt ?? 0) - (right.addedAt ?? 0))
  if (!latest && added.length === 0) {
    return null
  }
  const delivered = person?.deliveredRevision ?? 0
  const agentItems = latest?.items ?? []
  const listed = [
    ...agentItems.map((item) => ({ ...item, source: 'agent' as const })),
    ...added.map(([, mark]) => ({ text: mark.text, checked: false, source: 'person' as const }))
  ]
  const items = listed.map((item): NativeChatChecklistItem => {
    const key = nativeChatChecklistItemKey(item.text)
    const agent = agentChange.get(key)
    const mark = person?.marks[key]
    const agentAt = agent?.at ?? 0
    const personWins = mark?.checked !== undefined && (mark.checkedAt ?? 0) > agentAt
    const agentSet = !personWins && Boolean(agent?.changed)
    return {
      key,
      text: item.text,
      source: item.source,
      checked: personWins ? Boolean(mark?.checked) : item.checked,
      by: personWins ? 'person' : agentSet ? 'agent' : null,
      at: personWins ? (mark?.checkedAt ?? null) : agentSet ? agentAt : null,
      note: mark?.note ?? null,
      noteAt: mark?.noteAt ?? null,
      screenshots: mark?.screenshots ?? [],
      unseen: mark !== undefined && mark.revision > delivered
    }
  })
  return {
    title: title ?? person?.title ?? null,
    items,
    checked: items.filter((item) => item.checked).length,
    unseen: items.filter((item) => item.unseen).length
  }
}

/**
 * The block the host puts before the person's message: every mark changed since the agent last
 * read the list. Screenshots go as host paths, never image blocks, so an agent without image
 * prompts still accepts the message and can open the file with its own tools.
 */
export function nativeChatChecklistUpdateText(state: NativeChatChecklistPersonState): string | null {
  const changed = Object.values(state.marks)
    .filter((mark) => mark.revision > state.deliveredRevision)
    .sort((left, right) => left.revision - right.revision)
  if (changed.length === 0) {
    return null
  }
  const lines = [
    UPDATE_OPEN,
    `Checklist${state.title ? ` "${state.title}"` : ''}: changes by the person since your last turn.`
  ]
  for (const mark of changed) {
    if (mark.removed) {
      lines.push(`- ${mark.text} (removed by the person)`)
      continue
    }
    const box = mark.checked === undefined ? '' : mark.checked ? '[x] ' : '[ ] '
    const verb =
      mark.checked === undefined
        ? ''
        : mark.checked
          ? ' (checked by the person)'
          : ' (unchecked by the person)'
    const added = mark.addedAt !== undefined ? ' (added by the person)' : ''
    lines.push(`- ${box}${mark.text}${added}${verb}`)
    if (mark.note) {
      lines.push(`  note: ${mark.note.replace(/\s*\n\s*/g, ' ')}`)
    }
    for (const shot of mark.screenshots ?? []) {
      lines.push(`  screenshot: ${shot.path}`)
    }
  }
  lines.push(UPDATE_CLOSE)
  return lines.join('\n')
}

/** A user message split into the host's checklist update and what the person typed. */
export function splitNativeChatChecklistUpdate(text: string): {
  update: string | null
  rest: string
} {
  if (!text.startsWith(UPDATE_OPEN)) {
    return { update: null, rest: text }
  }
  const end = text.indexOf(UPDATE_CLOSE)
  if (end === -1) {
    return { update: null, rest: text }
  }
  return {
    update: text.slice(UPDATE_OPEN.length, end).trim(),
    rest: text.slice(end + UPDATE_CLOSE.length).replace(/^\s+/, '')
  }
}
