// A question the host asks on its own behalf, such as a delegated session's agent choice: no
// provider callback waits behind it, so an answer or a Cancel is resolved here and never reaches the
// provider adapter. The resolver is the runtime's; this module only fixes how the wire reaches it.

import {
  delegationRequestIdOfQuestionItem,
  isHostOwnedDelegationQuestion
} from '../../../shared/delegated-session-journal'
import type { AgentJournalItemBody } from '../../../shared/agent-session-journal-types'

export type StructuredAgentSessionHostOwnedPromptOutcome =
  | {
      ok: true
      /** Runs once the resolution is in the journal; the work the answer starts must not outrun it. */
      afterCommit: () => void
      /** Takes back what the answer claimed, when the journal does not record the resolution. */
      rollback?: () => void
    }
  | { ok: false; reason: 'optionRejected' | 'promptGone'; message: string }

export type StructuredAgentSessionHostOwnedPrompts = {
  /** The choice a person made on a pending host-owned question. Idempotent per request and choice. */
  answer: (input: {
    sessionId: string
    itemId: string
    optionId: string
  }) => Promise<StructuredAgentSessionHostOwnedPromptOutcome>
  /** The question dismissed without a choice. */
  cancel: (input: {
    sessionId: string
    itemId: string
  }) => Promise<StructuredAgentSessionHostOwnedPromptOutcome>
}

/** Whether an item is a host-owned question, by its key alone: provider prompts never carry it. */
export function isHostOwnedPromptItemId(itemId: string): boolean {
  return delegationRequestIdOfQuestionItem(itemId) !== null
}

export function isHostOwnedPromptItem(itemId: string, body: AgentJournalItemBody): boolean {
  return isHostOwnedPromptItemId(itemId) || isHostOwnedDelegationQuestion(body)
}
