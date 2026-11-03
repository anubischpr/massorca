import {
  AGENT_SESSION_HISTORY_MAX_LIMIT,
  type AgentSessionHistoryResult
} from '../../../../../shared/agent-session-wire'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session-journal-types'
import {
  nativeChatChecklist,
  nativeChatChecklistBlocksInReply,
  type NativeChatChecklistPersonState
} from '../../../../../shared/native-chat-checklist'
import type { AgentSessionChecklistResult } from '../../../../../shared/rpc-contract/agent-session-checklist-params'
import { callRuntimeRpc, type RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { nativeChatChecklistRepliesFromItems } from '../../native-chat/native-chat-checklist-replies'

// Why: a chat nobody has open has no live journal here, so its replies are read at rest, a few
// pages back at most, which finds the agent's latest list without walking a long conversation.
const MAX_JOURNAL_PAGES = 3
const FRESH_MS = 15_000
const MAX_PARALLEL_READS = 4

export type SessionChecklistProgress = { checked: number; total: number }

function hasChecklistReply(items: readonly AgentJournalRenderItem[]): boolean {
  return nativeChatChecklistRepliesFromItems(items).some(
    (reply) => nativeChatChecklistBlocksInReply(reply.markdown).length > 0
  )
}

/** The newest replies of a chat, extended backwards until one carries a checklist; null if unreadable. */
export async function readSessionJournalItems(
  target: RuntimeClientTarget,
  sessionId: string
): Promise<AgentJournalRenderItem[] | null> {
  let items: AgentJournalRenderItem[] = []
  let cursor: AgentSessionHistoryResult['page']['window']['oldest'] = null
  for (let pageIndex = 0; pageIndex < MAX_JOURNAL_PAGES; pageIndex += 1) {
    let result: AgentSessionHistoryResult
    try {
      result = await callStructuredAgentSession<AgentSessionHistoryResult>(
        target,
        'agentSession.history',
        pageIndex === 0
          ? { sessionId, direction: 'tail', limit: AGENT_SESSION_HISTORY_MAX_LIMIT }
          : { sessionId, direction: 'before', cursor, limit: AGENT_SESSION_HISTORY_MAX_LIMIT }
      )
    } catch {
      return pageIndex === 0 ? null : items
    }
    // A reset still carries a tail page, which is all this read needs.
    if (!result.ok && pageIndex > 0) {
      break
    }
    items = [...result.page.items, ...items]
    cursor = result.page.window.oldest
    if (hasChecklistReply(items) || !result.page.hasOlder || !cursor) {
      break
    }
  }
  return items
}

/** The person's marks from the chat's host; null from a host that predates them or cannot answer. */
export async function readSessionChecklistMarks(
  target: RuntimeClientTarget,
  sessionId: string
): Promise<NativeChatChecklistPersonState | null> {
  try {
    const result = await callRuntimeRpc<AgentSessionChecklistResult>(
      target,
      'agentSessionChecklist.read',
      { sessionId }
    )
    return result.ok ? result.state : null
  } catch {
    return null
  }
}

type CacheEntry = { at: number; progress: Promise<SessionChecklistProgress | null> }
const cache = new Map<string, CacheEntry>()
let running = 0
const waiting: (() => void)[] = []

async function withReadSlot<T>(read: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL_READS) {
    await new Promise<void>((resolve) => waiting.push(resolve))
  }
  running += 1
  try {
    return await read()
  } finally {
    running -= 1
    waiting.shift()?.()
  }
}

function targetKey(target: RuntimeClientTarget): string {
  return target.kind === 'local' ? 'local' : `env:${target.environmentId}`
}

/**
 * How far a session's checklist is, or null when it has none. Reads are shared while fresh and run a
 * few at a time, so opening the picker over many chats stays bounded and nothing polls.
 */
export function readSessionChecklistProgress(
  target: RuntimeClientTarget,
  sessionId: string
): Promise<SessionChecklistProgress | null> {
  const key = `${targetKey(target)}:${sessionId}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < FRESH_MS) {
    return cached.progress
  }
  const progress = withReadSlot(async () => {
    const [items, marks] = await Promise.all([
      readSessionJournalItems(target, sessionId),
      readSessionChecklistMarks(target, sessionId)
    ])
    const checklist = nativeChatChecklist(nativeChatChecklistRepliesFromItems(items ?? []), marks)
    return checklist && checklist.items.length > 0
      ? { checked: checklist.checked, total: checklist.items.length }
      : null
  })
  cache.set(key, { at: Date.now(), progress })
  return progress
}

export function resetSessionChecklistReaderForTest(): void {
  cache.clear()
  waiting.length = 0
  running = 0
}
