import type { AgentJournalRenderItem, AgentJournalSnapshot } from './agent-session-journal-types'
import { agentJournalSubmissionKey } from './agent-session-journal-item-key'
import { isRootAgentJournalItem } from './agent-session-journal-producer'
import { isStructuredAgentSessionCommandEntry } from './structured-agent-session-command-entry'
import { firstStructuredAgentSessionPrompt } from './structured-agent-session-first-prompt'
import { findOrcaDispatchTaskBody } from './orca-dispatch-status-prompt'
import { splitPrototypeHiddenInstruction } from './prototype-hidden-instruction'

export function firstStructuredChatNamingPrompt(
  snapshot: AgentJournalSnapshot,
  hostStartedAt: number
): string {
  const messages = snapshot.items.filter(
    (item) =>
      item.body.kind === 'message' &&
      item.body.role === 'user' &&
      isRootAgentJournalItem(item) &&
      !isStructuredAgentSessionCommandEntry(item.body)
  )
  const first = messages[0]
  if (messages.length !== 1 || !first) {
    return ''
  }
  const submission = snapshot.submissions.find(
    (send) =>
      send.providerItemId === first.itemId ||
      agentJournalSubmissionKey(send.clientMessageId) === first.itemId
  )
  if (
    !submission ||
    submission.submittedAt < hostStartedAt ||
    submission.recovered ||
    (submission.dispatchState !== 'accepted' && submission.dispatchState !== 'pending')
  ) {
    return ''
  }
  return firstNamingText(first)
}

/**
 * A dispatch preamble is named from its task body, never its boilerplate. The body sits past the
 * prompt cap, so it is read from the whole block; an empty task yields '' rather than the preamble.
 */
function firstNamingText(first: AgentJournalRenderItem): string {
  if (first.body.kind === 'message') {
    for (const block of first.body.blocks) {
      const task = block.type === 'text' ? findOrcaDispatchTaskBody(block.text) : null
      if (task !== null) {
        // Why: a delegated child's hidden prototype instruction rides after its task, and a title never reads it.
        return splitPrototypeHiddenInstruction(task).visibleText
      }
    }
  }
  return firstStructuredAgentSessionPrompt([first])
}
