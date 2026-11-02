import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { callRuntimeRpc, RuntimeRpcCallError } from '@/runtime/runtime-rpc-client'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import {
  nativeChatChecklist,
  nativeChatChecklistBlocksInReply,
  type NativeChatChecklist,
  type NativeChatChecklistPersonState
} from '../../../../shared/native-chat-checklist'
import type {
  AgentSessionChecklistResult,
  AgentSessionChecklistSetItemParams
} from '../../../../shared/rpc-contract/agent-session-checklist-params'
import { nativeChatChecklistRepliesFromItems } from './native-chat-checklist-replies'

const POLL_INTERVAL_MS = 4_000

export type NativeChatChecklistSetItem = Omit<AgentSessionChecklistSetItemParams, 'sessionId'>

export type NativeChatChecklistState = {
  checklist: NativeChatChecklist | null
  /** When the agent last wrote the list: the reply that carries its latest block. */
  writtenAt: number | null
  /** An older host without the checklist methods: the list can be read but not changed. */
  readOnly: boolean
  /** Writes one item's marks; false when the host did not take them. */
  setItem: (params: NativeChatChecklistSetItem) => Promise<boolean>
}

function isMethodMissing(error: unknown): boolean {
  return error instanceof RuntimeRpcCallError && error.code === 'method_not_found'
}

/**
 * The chat's checklist: the agent's items from its replies, merged with the person's marks as the
 * chat's host keeps them. The marks are read on mount, when the chat gains a message, and every few
 * seconds while the card is open; a mark the person sets applies at once.
 */
export function useNativeChatChecklist(args: {
  target: RuntimeClientTarget
  sessionId: string
  journalItems: readonly AgentJournalRenderItem[]
  /** Whether the card is open, so the marks are polled only while someone can see them. */
  polling: boolean
}): NativeChatChecklistState {
  const { journalItems, polling, sessionId } = args
  const targetRef = useRef(args.target)
  useLayoutEffect(() => {
    targetRef.current = args.target
  })

  const replies = useMemo(() => nativeChatChecklistRepliesFromItems(journalItems), [journalItems])
  // Why: a chat that never wrote a list makes no host reads; the marks only mean something beside one.
  const hasBlocks = useMemo(
    () => replies.some((reply) => nativeChatChecklistBlocksInReply(reply.markdown).length > 0),
    [replies]
  )
  const messageCount = useMemo(
    () => journalItems.filter((item) => item.body.kind === 'message').length,
    [journalItems]
  )
  const [person, setPerson] = useState<NativeChatChecklistPersonState | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  // A read that another read or a write has overtaken must not overwrite what is newer.
  const latestRequest = useRef(0)

  const read = useCallback(async (): Promise<void> => {
    latestRequest.current += 1
    const request = latestRequest.current
    try {
      const result = await callRuntimeRpc<AgentSessionChecklistResult>(
        targetRef.current,
        'agentSessionChecklist.read',
        { sessionId }
      )
      if (request === latestRequest.current && result.ok) {
        setPerson(result.state)
        setReadOnly(false)
      }
    } catch (error) {
      if (isMethodMissing(error)) {
        setReadOnly(true)
      }
    }
  }, [sessionId])

  const setItem = useCallback(
    async (params: NativeChatChecklistSetItem): Promise<boolean> => {
      try {
        const result = await callRuntimeRpc<AgentSessionChecklistResult>(
          targetRef.current,
          'agentSessionChecklist.setItem',
          { sessionId, ...params }
        )
        if (!result.ok) {
          return false
        }
        latestRequest.current += 1
        setPerson(result.state)
        setReadOnly(false)
        return true
      } catch (error) {
        if (isMethodMissing(error)) {
          setReadOnly(true)
        }
        return false
      }
    },
    [sessionId]
  )

  useEffect(() => {
    if (hasBlocks) {
      void read()
    }
  }, [hasBlocks, messageCount, read])

  useEffect(() => {
    if (!polling || readOnly || !hasBlocks) {
      return
    }
    const timer = setInterval(() => void read(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [hasBlocks, polling, read, readOnly])

  const checklist = useMemo(() => nativeChatChecklist(replies, person), [person, replies])
  const writtenAt = useMemo(
    () =>
      replies.findLast((reply) => nativeChatChecklistBlocksInReply(reply.markdown).length > 0)
        ?.at ?? null,
    [replies]
  )
  return { checklist, writtenAt, readOnly, setItem }
}
