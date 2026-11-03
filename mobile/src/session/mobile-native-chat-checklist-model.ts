import {
  NATIVE_CHAT_CHECKLIST_FENCE_INFO,
  nativeChatChecklistBlocksInReply,
  type NativeChatChecklistItem,
  type NativeChatChecklistReply
} from '../../../src/shared/native-chat-checklist'
import { isTextBlock, type NativeChatMessage } from '../../../src/shared/native-chat-types'

/** A piece of an assistant reply: prose to draw as markdown, or one finished checklist fence. */
export type MobileNativeChatChecklistSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'checklist'; text: string }

// The shared parser's fence grammar: a fence closes with its own character, at least as long.
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/

// Blank lines at the edges of a prose run belong to the fence around it, not to the prose.
function pushMarkdown(segments: MobileNativeChatChecklistSegment[], lines: string[]): void {
  let start = 0
  let end = lines.length
  while (start < end && (lines[start] ?? '').trim() === '') {
    start += 1
  }
  while (end > start && (lines[end - 1] ?? '').trim() === '') {
    end -= 1
  }
  if (start < end) {
    segments.push({ kind: 'markdown', text: lines.slice(start, end).join('\n') })
  }
}

/**
 * Splits markdown at each finished `orca-checklist` fence. An unclosed fence is not a checklist yet
 * (the shared parser counts a block only once it closes), so it stays markdown while the reply streams.
 */
export function splitNativeChatChecklistMarkdown(
  markdown: string
): MobileNativeChatChecklistSegment[] {
  if (!markdown.includes(NATIVE_CHAT_CHECKLIST_FENCE_INFO)) {
    return [{ kind: 'markdown', text: markdown }]
  }
  const lines = markdown.split('\n')
  const segments: MobileNativeChatChecklistSegment[] = []
  let runStart = 0
  let fence: { marker: string; checklist: boolean; start: number } | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').replace(/\r$/, '')
    if (fence) {
      const closer = FENCE_CLOSE.exec(line)?.[1]
      if (closer && closer[0] === fence.marker[0] && closer.length >= fence.marker.length) {
        if (fence.checklist) {
          pushMarkdown(segments, lines.slice(runStart, fence.start))
          segments.push({ kind: 'checklist', text: lines.slice(fence.start, index + 1).join('\n') })
          runStart = index + 1
        }
        fence = null
      }
      continue
    }
    const opener = FENCE_OPEN.exec(line)
    if (opener) {
      fence = {
        marker: opener[1] ?? '',
        checklist: opener[2] === NATIVE_CHAT_CHECKLIST_FENCE_INFO,
        start: index
      }
    }
  }
  pushMarkdown(segments, lines.slice(runStart))
  return segments
}

/** The reply's prose without its checklist fences, for previews and copies. */
export function withoutNativeChatChecklistFences(markdown: string): string {
  return splitNativeChatChecklistMarkdown(markdown)
    .filter((segment) => segment.kind === 'markdown')
    .map((segment) => segment.text)
    .join('\n')
}

/**
 * The main agent's assistant replies that carry a checklist fence, as the shared checklist reads
 * them. Subagent rows never write the chat's checklist.
 */
export function nativeChatChecklistRepliesOf(
  messages: readonly NativeChatMessage[]
): NativeChatChecklistReply[] {
  const replies: NativeChatChecklistReply[] = []
  for (const message of messages) {
    if (message.role !== 'assistant' || message.agentId !== undefined) {
      continue
    }
    const markdown = message.blocks
      .filter(isTextBlock)
      .map((block) => block.text)
      .join('\n')
    if (markdown.includes(NATIVE_CHAT_CHECKLIST_FENCE_INFO)) {
      replies.push({ at: message.timestamp ?? 0, markdown })
    }
  }
  return replies
}

/** When the agent last wrote a finished checklist block, or null while it has written none. */
export function nativeChatChecklistWrittenAt(
  replies: readonly NativeChatChecklistReply[]
): number | null {
  for (let index = replies.length - 1; index >= 0; index -= 1) {
    const reply = replies[index]
    if (reply && nativeChatChecklistBlocksInReply(reply.markdown).length > 0) {
      return reply.at
    }
  }
  return null
}

/** Local clock time as HH:MM. */
export function mobileNativeChatChecklistClock(at: number): string {
  const date = new Date(at)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "<title> · from <agent>, HH:MM", the line under the Checklist sheet's count. */
export function mobileNativeChatChecklistSourceLine(input: {
  title: string | null
  agentLabel: string
  at: number | null
}): string {
  const origin =
    input.at === null
      ? `from ${input.agentLabel}`
      : `from ${input.agentLabel}, ${mobileNativeChatChecklistClock(input.at)}`
  return input.title ? `${input.title} · ${origin}` : origin
}

/**
 * The meta line of one item row: who checked it and when ("You · 14:02"), then its note and
 * screenshots. An item the person added and nothing else touched reads "Added by you · 14:02".
 * Null when none of that applies.
 */
export function mobileNativeChatChecklistItemMeta(
  item: Pick<NativeChatChecklistItem, 'by' | 'at' | 'note' | 'screenshots'> & {
    addedAt?: number | null
  },
  agentLabel: string
): string | null {
  const parts: string[] = []
  if (item.by !== null && item.at !== null) {
    const who = item.by === 'person' ? 'You' : agentLabel
    parts.push(`${who} · ${mobileNativeChatChecklistClock(item.at)}`)
  }
  const count = item.screenshots.length
  const screenshots = count === 0 ? null : `${count} screenshot${count === 1 ? '' : 's'}`
  if (item.note) {
    parts.push(screenshots ? `Note · ${screenshots}` : 'Note')
  } else if (screenshots) {
    parts.push(screenshots)
  }
  if (parts.length === 0 && item.addedAt !== undefined && item.addedAt !== null) {
    parts.push(`Added by you · ${mobileNativeChatChecklistClock(item.addedAt)}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/** The ⋯ menu's hint on the Checklist row: "2 of 5", or "No items" while the list is empty. */
export function mobileNativeChatChecklistMenuHint(
  checklist: { checked: number; items: readonly unknown[] } | null
): string {
  if (checklist === null || checklist.items.length === 0) {
    return 'No items'
  }
  return `${checklist.checked} of ${checklist.items.length}`
}

/** The footer above "Send now": the changes the agent has not seen yet. */
export function mobileNativeChatChecklistUnseenText(count: number): string {
  return count === 1
    ? '1 change the agent has not seen. It goes with your next message.'
    : `${count} changes the agent has not seen. They go with your next message.`
}

/** The file name a picked screenshot carries: the last segment of its host path. */
export function mobileNativeChatChecklistScreenshotName(path: string): string {
  const segment = path.split(/[\\/]/).pop()
  return segment && segment.length > 0 ? segment : 'screenshot.png'
}
