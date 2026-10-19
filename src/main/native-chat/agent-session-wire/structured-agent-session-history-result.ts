import type { AgentSessionRecord } from '../../../shared/agent-session-record'
import { agentSessionProviderHandleChainHead } from '../../../shared/agent-session-provider-handle'
import type { AgentProviderSessionMetadata } from '../../../shared/agent-session-resume'
import type {
  AgentSessionHistoryRequest,
  AgentSessionHistoryResult
} from '../../../shared/agent-session-wire'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'
import {
  readAgentSessionHistory,
  type AgentSessionHistoryScope
} from './agent-session-history-page'

export function structuredAgentSessionProviderSessionMetadata(
  record: AgentSessionRecord | null
): AgentProviderSessionMetadata | undefined {
  const head = record ? agentSessionProviderHandleChainHead(record.providerHandleChain) : null
  if (!head) {
    return undefined
  }
  const { agent, nativeId } = head.handle
  // Why: terminal resume keys differ per agent; Pi's native id is its session file, which its resume flag needs.
  if (agent === 'antigravity') {
    return { key: 'conversation_id', id: nativeId }
  }
  if (agent === 'pi') {
    return { key: 'session_id', id: nativeId, transcriptPath: nativeId }
  }
  return { key: 'session_id', id: nativeId }
}

export function readStructuredAgentSessionHistoryResult(input: {
  journal: AgentSessionJournal
  record: AgentSessionRecord | null
  request: AgentSessionHistoryRequest
  scope?: AgentSessionHistoryScope
}): AgentSessionHistoryResult {
  const result = readAgentSessionHistory(input.journal, input.request, undefined, input.scope)
  const fence = input.record?.lease.runtimeFence
  const providerSession = structuredAgentSessionProviderSessionMetadata(input.record)
  if (fence === undefined) {
    return providerSession ? { ...result, providerSession } : result
  }
  return {
    ...result,
    page: { ...result.page, fence },
    ...(result.ok ? {} : { fence }),
    ...(providerSession ? { providerSession } : {})
  }
}
