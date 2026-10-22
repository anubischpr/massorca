import type {
  AgentJournalItemBody,
  AgentJournalRenderItem,
  AgentJournalSubmission
} from './agent-session-journal-types'
import { isAgentSessionProviderContextBoundary } from './agent-session-provider-context'
import type { NativeChatMessage } from './native-chat-types'

export function isAgentSessionContextClear(body: AgentJournalItemBody | undefined): boolean {
  return body?.kind === 'status' && isAgentSessionProviderContextBoundary(body.contextClear)
}

export function isNativeChatContextClear(message: NativeChatMessage): boolean {
  return (
    message.role === 'system' &&
    message.blocks.some(
      (block) => block.type === 'text' && isAgentSessionProviderContextBoundary(block.contextClear)
    )
  )
}

export function agentSessionContextSequenceFor(
  sequence: number,
  boundaries: readonly number[]
): number {
  let left = 0
  let right = boundaries.length
  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (boundaries[middle] < sequence) {
      left = middle + 1
    } else {
      right = middle
    }
  }
  return left > 0 ? boundaries[left - 1] : 0
}

export function latestAgentSessionContextClearSequence(
  items: Iterable<Pick<AgentJournalRenderItem, 'sequence' | 'body'>>
): number {
  let sequence = 0
  for (const item of items) {
    if (item.sequence > sequence && isAgentSessionContextClear(item.body)) {
      sequence = item.sequence
    }
  }
  return sequence
}

export function agentSessionCurrentContextRows(
  items: readonly AgentJournalRenderItem[],
  submissions: readonly AgentJournalSubmission[] = [],
  minimumSequence = 0
) {
  const sequence = Math.max(minimumSequence, latestAgentSessionContextClearSequence(items))
  return sequence > 0
    ? {
        items: items.filter((item) => item.sequence > sequence),
        submissions: submissions.filter(
          (submission) => (submission.acceptedSequence ?? 0) > sequence
        )
      }
    : { items, submissions }
}

/** What a chat draws once its newest `/clear` boundary is the top of the screen: the boundary row
 *  itself, so the divider stays, and everything after it. A send not yet accepted is kept, since it
 *  is newer than any boundary. `boundary` is 0 when the loaded rows hold no clear. */
export function agentSessionTranscriptSinceClear(
  items: readonly AgentJournalRenderItem[],
  submissions: readonly AgentJournalSubmission[]
): {
  boundary: number
  items: readonly AgentJournalRenderItem[]
  submissions: readonly AgentJournalSubmission[]
} {
  const boundary = latestAgentSessionContextClearSequence(items)
  if (boundary === 0) {
    return { boundary, items, submissions }
  }
  return {
    boundary,
    items: items.filter((item) => item.sequence >= boundary),
    submissions: submissions.filter(
      (submission) =>
        submission.acceptedSequence === undefined || submission.acceptedSequence > boundary
    )
  }
}
