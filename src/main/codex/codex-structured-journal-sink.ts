import {
  agentJournalTurnRowReservedBytes,
  resolveAgentJournalTurnRowWrite
} from '../native-chat/agent-session-timeline/agent-journal-turn-row-revision'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity,
  AgentJournalRowAttribution
} from '../../shared/agent-session-journal-types'
import type {
  StructuredAgentSessionItemAppendOptions,
  StructuredAgentSessionEventSink,
  StructuredAgentSessionLifecycleIdentityResolver,
  StructuredAgentSessionSinkAdmission
} from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import {
  journalLifecycleItemMutation,
  type JournalLifecycleIdentityMutationInput
} from '../native-chat/agent-session-journal/journal-row-builders'
import type { CodexPendingJournalPrompt } from './codex-structured-journal-settlement'
import type { CodexJournalTranslationAdmission } from './codex-structured-journal-contracts'
import { CODEX_JOURNAL_ADMITTED } from './codex-structured-journal-contracts'

const ADMITTED: StructuredAgentSessionSinkAdmission = { accepted: true }

export function appendCodexLifecycleMutations(
  sink: StructuredAgentSessionEventSink,
  settlementId: string,
  mutations: readonly JournalLifecycleIdentityMutationInput[]
): StructuredAgentSessionSinkAdmission {
  if (mutations.length === 0) {
    return ADMITTED
  }
  let admission: StructuredAgentSessionSinkAdmission = ADMITTED
  // Resolve lifecycle turn rows at execution so a completion keeps context measured mid-turn.
  if (
    sink.tryAppendTransition &&
    mutations.some((row) => row.kind === 'item' && row.body.kind === 'turn')
  ) {
    const reservedBytes =
      Buffer.byteLength(JSON.stringify(mutations), 'utf8') +
      mutations.reduce(
        (total, row) =>
          total +
          (row.kind === 'item' && row.body.kind === 'turn'
            ? agentJournalTurnRowReservedBytes({ identity: row.identity }, { lifecycle: row.body })
            : 0),
        0
      )
    admission = sink.tryAppendTransition({
      lifecycle: true,
      publish: false,
      steps: [
        {
          kind: 'settlement',
          settlementId,
          reservedBytes,
          resolve: (journal) =>
            mutations.map((row) => {
              if (row.kind !== 'item' || row.body.kind !== 'turn') {
                return row
              }
              const target = { identity: row.identity }
              const write = { lifecycle: row.body }
              const resolved = resolveAgentJournalTurnRowWrite(
                journal,
                target,
                write,
                agentJournalTurnRowReservedBytes(target, write)
              )
              return resolved ? { ...row, body: resolved.body } : row
            })
        }
      ]
    })
  } else if (sink.tryAppendLifecycleBatch) {
    admission = sink.tryAppendLifecycleBatch(settlementId, mutations, { lifecycle: true })
  } else if (sink.appendLifecycleBatch) {
    admission = sink.appendLifecycleBatch(settlementId, mutations, { lifecycle: true }) ?? ADMITTED
  } else {
    for (const mutation of mutations) {
      if (mutation.kind === 'item') {
        const options = {
          lifecycle: true,
          ...mutation.linkage,
          turnScope: mutation.turnScope
        }
        if (sink.tryAppendItem) {
          admission = sink.tryAppendItem(mutation.identity, mutation.body, options)
        } else {
          sink.appendItem(mutation.identity, mutation.body, options)
        }
      } else if (sink.tryAppendTombstone) {
        admission = sink.tryAppendTombstone(mutation.identity, { lifecycle: true })
      } else {
        sink.appendTombstone(mutation.identity, { lifecycle: true })
      }
      if (!admission.accepted) {
        return admission
      }
    }
  }
  if (!admission.accepted) {
    return admission
  }
  return sink.tryPublish
    ? sink.tryPublish({ lifecycle: true })
    : (sink.publish({ lifecycle: true }), ADMITTED)
}

/** An ordinary (non-lifecycle) append, published once admitted. */
export function appendCodexItemAndPublish(
  sink: StructuredAgentSessionEventSink,
  identity: AgentJournalItemIdentity,
  body: AgentJournalItemBody,
  options: StructuredAgentSessionItemAppendOptions
): StructuredAgentSessionSinkAdmission {
  const admission = sink.tryAppendItem
    ? sink.tryAppendItem(identity, body, options)
    : (sink.appendItem(identity, body, options), ADMITTED)
  if (!admission.accepted) {
    return admission
  }
  return sink.tryPublish ? sink.tryPublish() : (sink.publish(), ADMITTED)
}

function criticalAdmission(
  admission: StructuredAgentSessionSinkAdmission
): CodexJournalTranslationAdmission {
  return admission.accepted ? CODEX_JOURNAL_ADMITTED : admission
}

export function appendCodexLifecycleItem(
  sink: StructuredAgentSessionEventSink,
  identity: AgentJournalItemIdentity,
  body: AgentJournalItemBody,
  /** With the host time a row first written here should carry instead of its append time. */
  attribution: AgentJournalRowAttribution & { observedAt?: number }
): CodexJournalTranslationAdmission {
  const options = { lifecycle: true, ...attribution }
  if (sink.tryAppendItem) {
    return criticalAdmission(sink.tryAppendItem(identity, body, options))
  }
  sink.appendItem(identity, body, options)
  return CODEX_JOURNAL_ADMITTED
}

export function appendCodexLifecycleTransition(
  sink: StructuredAgentSessionEventSink,
  identitySizeBound: AgentJournalItemIdentity,
  body: AgentJournalItemBody,
  resolveIdentity: StructuredAgentSessionLifecycleIdentityResolver,
  attribution: AgentJournalRowAttribution
): CodexJournalTranslationAdmission {
  if (sink.tryAppendLifecycleTransition) {
    return criticalAdmission(
      sink.tryAppendLifecycleTransition(identitySizeBound, body, resolveIdentity, attribution)
    )
  }
  const admission = appendCodexLifecycleItem(sink, identitySizeBound, body, attribution)
  return admission.accepted ? publishCodexLifecycle(sink) : admission
}

export function publishCodexLifecycle(
  sink: StructuredAgentSessionEventSink
): CodexJournalTranslationAdmission {
  if (sink.tryPublish) {
    return criticalAdmission(sink.tryPublish({ lifecycle: true }))
  }
  sink.publish({ lifecycle: true })
  return CODEX_JOURNAL_ADMITTED
}

/** One producer's rows, admitted together. */
export function admitCodexLifecycleItems(
  sink: StructuredAgentSessionEventSink,
  settlementId: string,
  items: readonly Pick<CodexPendingJournalPrompt, 'identity' | 'body'>[],
  attribution: AgentJournalRowAttribution
): CodexJournalTranslationAdmission {
  if (items.length === 0) {
    return { accepted: false, reason: 'untranslated' }
  }
  if (sink.tryAppendLifecycleBatch) {
    const admission = criticalAdmission(
      sink.tryAppendLifecycleBatch(
        settlementId,
        items.map((item) => journalLifecycleItemMutation(attribution, item.identity, item.body)),
        { lifecycle: true }
      )
    )
    return admission.accepted ? publishCodexLifecycle(sink) : admission
  }
  for (const item of items) {
    const admission = appendCodexLifecycleItem(sink, item.identity, item.body, attribution)
    if (!admission.accepted) {
      return admission
    }
  }
  return publishCodexLifecycle(sink)
}
