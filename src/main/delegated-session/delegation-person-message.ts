import type { AgentJournalItemBody } from '../../shared/agent-session-journal-types'

/**
 * The text of the person's latest message in a chat's journal: the newest user row that no other agent sent.
 * A delegation made during that turn answers it, so its wording says what the person asked for.
 */
export function lastPersonMessageText(
  items: readonly { body: AgentJournalItemBody }[]
): string | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const body = items[index]?.body
    if (body?.kind !== 'message' || body.role !== 'user' || body.from !== undefined) {
      continue
    }
    const text = body.blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim()
    return text.length > 0 ? text : undefined
  }
  return undefined
}
