import type { AgentJournalItemBody } from '../../shared/agent-session-journal-types'
import {
  boundInlineText,
  DEFAULT_JOURNAL_PAYLOAD_LIMITS
} from '../native-chat/agent-session-journal/journal-payload-bounds'
import { readString } from './codex-item-field-readers'
import type { CodexThreadItem } from './codex-thread-item-identity'

/** `/review`'s items: entering the mode names what is reviewed, leaving it carries the findings as
 *  the markdown message the reviewer wrote. Null for any other item. */
export function codexReviewItemBody(item: CodexThreadItem): AgentJournalItemBody | null {
  const review = readString(item, 'review')
  if (review === null) {
    return null
  }
  const text = boundInlineText(review, DEFAULT_JOURNAL_PAYLOAD_LIMITS).text
  if (item.type === 'enteredReviewMode') {
    return { kind: 'status', tone: 'notice', text: `Reviewing: ${text}` }
  }
  return item.type === 'exitedReviewMode'
    ? { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text }] }
    : null
}
