// A journal double with the ordered steps used by lifecycle/context revisions.
import { vi } from 'vitest'
import { agentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../shared/agent-session-journal-types'
import type { JournalStep } from '../native-chat/agent-session-journal/journal-step-writer'
import type { JournalLifecycleMutationInput } from '../native-chat/agent-session-journal/journal-row-builders'
import type { StructuredAgentSessionEventTarget } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import { withJournalQueueMembers } from '../native-chat/agent-session-wire/structured-agent-session-journal-double-test-support'

export function codexDeferredJournalTarget(
  log: AgentJournalItemBody[],
  publishes: string[] = []
): StructuredAgentSessionEventTarget {
  const rows = new Map<string, AgentJournalItemBody>()
  const append = (identity: AgentJournalItemIdentity, body: AgentJournalItemBody) => {
    rows.set(agentJournalItemKey(identity), body)
    log.push(body)
  }
  return {
    fence: 7,
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a double for the journal members this path calls; the helper adds the in-order ones.
    journal: withJournalQueueMembers({
      epoch: 'e',
      itemBody: (itemId: string) => rows.get(itemId) ?? null,
      visitItems: (
        visit: (itemId: string, sequence: number, body: AgentJournalItemBody) => void
      ) => {
        let sequence = 0
        for (const [itemId, body] of rows) {
          visit(itemId, ++sequence, body)
        }
      },
      appendSteps: async (steps: readonly JournalStep[]) =>
        steps.map((step) => {
          if (step.kind === 'item') {
            const result = step.resolve()
            if (result) {
              append(result.identity, result.body)
            }
            return result !== null
          }
          const mutations = step.batch.resolve()
          for (const row of mutations) {
            if (row.kind === 'item' && row.identity) {
              append(row.identity, row.body)
            }
          }
          return mutations.length > 0
        }),
      appendItem: vi.fn(async (identity: AgentJournalItemIdentity, body: AgentJournalItemBody) => {
        append(identity, body)
        return { cursor: { epoch: 'e', sequence: log.length } }
      }),
      appendTombstone: vi.fn(async () => ({ epoch: 'e', sequence: log.length })),
      appendLifecycleBatch: vi.fn(
        async (input: { mutations: readonly JournalLifecycleMutationInput[] }) => {
          for (const mutation of input.mutations) {
            if (mutation.kind === 'item') {
              log.push(mutation.body)
            }
          }
          return { epoch: 'e', sequence: log.length }
        }
      )
    }) as unknown as StructuredAgentSessionEventTarget['journal'],
    publish: vi.fn(() => {
      publishes.push('publish')
    })
  }
}
