import {
  agentJournalItemKey,
  parseAgentJournalItemKey
} from '../../shared/agent-session-journal-item-key'
import type { AgentSessionContextUsage } from '../../shared/agent-session-context-usage'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../shared/agent-session-journal-types'
import {
  agentJournalTurnRowReservedBytes,
  resolveAgentJournalTurnRowWrite
} from '../native-chat/agent-session-timeline/agent-journal-turn-row-revision'
import {
  CODEX_JOURNAL_ADMITTED,
  type CodexJournalTranslatorDeps,
  type CodexJournalTranslationAdmission
} from './codex-structured-journal-contracts'
import { codexTurnLifecycleIdentity } from './codex-structured-journal-translation-turns'
import { readRecord, readString } from './codex-item-field-readers'

/** Active context is last.totalTokens; total.totalTokens accounts for the whole session. */
export function codexContextUsage(params: unknown, capturedAt: number): AgentSessionContextUsage {
  const usage = readRecord(readRecord(params).tokenUsage)
  const usedTokens = readRecord(usage.last).totalTokens
  const windowTokens = usage.modelContextWindow
  if (
    typeof usedTokens !== 'number' ||
    !Number.isSafeInteger(usedTokens) ||
    usedTokens < 0 ||
    typeof windowTokens !== 'number' ||
    !Number.isSafeInteger(windowTokens) ||
    windowTokens <= 0
  ) {
    return { used: { kind: 'unknown', capturedAt } }
  }
  return {
    used: { kind: 'snapshot', usedTokens, windowTokens, capturedAt },
    window: { tokens: windowTokens, capturedAt }
  }
}

export function writeCodexContextUsage(
  deps: CodexJournalTranslatorDeps,
  input: { sessionId: string; threadId: string; turnId: string },
  contextUsage: AgentSessionContextUsage
): CodexJournalTranslationAdmission {
  if (input.threadId !== deps.primaryThreadId?.() || !deps.sink.tryReviseResolvedItemAndPublish) {
    return CODEX_JOURNAL_ADMITTED
  }
  const target = { identity: codexTurnLifecycleIdentity(input.sessionId, input.turnId) }
  const write = { contextUsage }
  const reservedBytes = agentJournalTurnRowReservedBytes(target, write)
  return deps.sink.tryReviseResolvedItemAndPublish(
    reservedBytes,
    (journal) => {
      let resolvedTarget = target
      if (journal.itemBody(agentJournalItemKey(target.identity))?.kind !== 'turn') {
        // A /compact provider turn belongs to the host command's durable turn row.
        // Its persisted providerTurnId still places a late usage frame after completion.
        let commandItemId: string | null = null
        journal.visitItems((itemId, _sequence, body) => {
          if (body.kind === 'turn' && body.providerTurnId === input.turnId) {
            commandItemId = itemId
          }
        })
        const identity = commandItemId ? parseAgentJournalItemKey(commandItemId) : null
        if (!identity) {
          return null
        }
        resolvedTarget = { identity }
      }
      return resolveAgentJournalTurnRowWrite(journal, resolvedTarget, write, reservedBytes)
    },
    { turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
}

/** Unknown identities are not root measurements. Older providers omit the optional usage fields. */
export function recordCodexContextUsage(
  deps: CodexJournalTranslatorDeps,
  event: { sessionId: string; threadId: string; params: unknown; observedAt?: number }
): CodexJournalTranslationAdmission {
  const root = readRecord(event.params)
  const turnId = readString(root, 'turnId')
  if (root.threadId !== event.threadId || !turnId) {
    return CODEX_JOURNAL_ADMITTED
  }
  return writeCodexContextUsage(
    deps,
    { ...event, turnId },
    codexContextUsage(event.params, event.observedAt ?? deps.now?.() ?? Date.now())
  )
}
