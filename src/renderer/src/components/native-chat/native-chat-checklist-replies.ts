import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import {
  nativeChatChecklistBlocksInReply,
  NATIVE_CHAT_CHECKLIST_FENCE_INFO,
  type NativeChatChecklistBlock,
  type NativeChatChecklistReply
} from '../../../../shared/native-chat-checklist'
import { nativeChatProseToMarkdown } from '../../../../shared/native-chat-prose'

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/

/** The main agent's replies that carry a checklist block, in order, as the checklist reads them. */
export function nativeChatChecklistRepliesFromItems(
  items: readonly AgentJournalRenderItem[]
): NativeChatChecklistReply[] {
  const replies: NativeChatChecklistReply[] = []
  for (const { agentId, body, observedAt } of items) {
    if (agentId !== undefined || body.kind !== 'message' || body.role !== 'assistant') {
      continue
    }
    const markdown = nativeChatProseToMarkdown(body.blocks)
    if (markdown.includes(NATIVE_CHAT_CHECKLIST_FENCE_INFO)) {
      replies.push({ at: observedAt, markdown })
    }
  }
  return replies
}

/** The checklist block a transcript fence holds, read from the code inside it; null when it has none. */
export function nativeChatChecklistFenceBlock(code: string): NativeChatChecklistBlock | null {
  const fence = '```'
  const blocks = nativeChatChecklistBlocksInReply(
    `${fence}${NATIVE_CHAT_CHECKLIST_FENCE_INFO}\n${code}\n${fence}`
  )
  return blocks[0] ?? null
}

/** The reply's text with each `orca-checklist` block removed, for copies and previews. */
export function withoutNativeChatChecklistBlocks(markdown: string): string {
  if (!markdown.includes(NATIVE_CHAT_CHECKLIST_FENCE_INFO)) {
    return markdown
  }
  const kept: string[] = []
  let fence: { marker: string; checklist: boolean } | null = null
  for (const line of markdown.split('\n')) {
    const text = line.replace(/\r$/, '')
    if (fence) {
      const closer = FENCE_CLOSE.exec(text)?.[1]
      const closes =
        closer !== undefined &&
        closer[0] === fence.marker[0] &&
        closer.length >= fence.marker.length
      if (!fence.checklist) {
        kept.push(line)
      }
      if (closes) {
        fence = null
      }
      continue
    }
    const opener = FENCE_OPEN.exec(text)
    if (opener) {
      fence = { marker: opener[1], checklist: opener[2] === NATIVE_CHAT_CHECKLIST_FENCE_INFO }
      if (!fence.checklist) {
        kept.push(line)
      }
      continue
    }
    kept.push(line)
  }
  return kept.join('\n')
}
