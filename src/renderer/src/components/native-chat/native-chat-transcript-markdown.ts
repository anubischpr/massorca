import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { nativeChatProseToMarkdown } from '../../../../shared/native-chat-prose'
import { withoutPrototypeHiddenInstruction } from '../../../../shared/prototype-hidden-blocks'

/** The newest reply the agent wrote in this chat, as Markdown; empty when it has written none. */
export function nativeChatLatestAnswerMarkdown(items: readonly AgentJournalRenderItem[]): string {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const { body } = items[index]!
    if (body.kind === 'message' && body.role === 'assistant') {
      const markdown = nativeChatProseToMarkdown(body.blocks).trim()
      if (markdown !== '') {
        return markdown
      }
    }
  }
  return ''
}

/** The chat's prompts and replies in order, each under a heading that names its speaker. */
export function nativeChatTranscriptMarkdown(
  items: readonly AgentJournalRenderItem[],
  names: { you: string; agent: string }
): string {
  const sections: string[] = []
  for (const { body } of items) {
    if (body.kind !== 'message' || (body.role !== 'user' && body.role !== 'assistant')) {
      continue
    }
    const blocks =
      body.role === 'user' ? withoutPrototypeHiddenInstruction(body.blocks) : body.blocks
    const markdown = nativeChatProseToMarkdown(blocks).trim()
    if (markdown !== '') {
      sections.push(`## ${body.role === 'user' ? names.you : names.agent}\n\n${markdown}`)
    }
  }
  return sections.join('\n\n')
}
