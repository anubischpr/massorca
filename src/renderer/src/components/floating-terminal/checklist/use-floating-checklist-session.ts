import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'
import type { Tab } from '../../../../../shared/tab-types'
import {
  resolveFollowedChecklistSession,
  selectChatInFocusSessionId,
  selectRecentChatSessionIds
} from '@/lib/floating-workspace-checklist-tab'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { structuredAgentSessionTargetForTab } from '@/runtime/structured-agent-session-owner'
import { useAppStore } from '@/store'
import { usePrototypeViewStore } from '../../prototypes/prototype-view-store'
import { useFloatingChecklistPinStore } from './floating-checklist-pin'
import {
  readSessionChecklistProgress,
  type SessionChecklistProgress
} from './floating-checklist-session-reader'

/** How many of the most recently active chats are read for a checklist when nothing else decides. */
const RECENT_SESSIONS_TO_READ = 6

export function followedOrPinnedChecklistSession(
  pinnedSessionId: string | null,
  followedSessionId: string | null
): { sessionId: string | null; pinned: boolean } {
  return pinnedSessionId !== null
    ? { sessionId: pinnedSessionId, pinned: true }
    : { sessionId: followedSessionId, pinned: false }
}

/** The chat tab behind a host session id, in any workspace; null when no workspace lists it. */
export function findChatTabBySessionId(
  state: Pick<ReturnType<typeof useAppStore.getState>, 'unifiedTabsByWorktree'>,
  sessionId: string
): Tab | null {
  for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
    if (worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
      continue
    }
    const tab = tabs.find(
      (row) => row.contentType === 'agent-session' && row.entityId === sessionId
    )
    if (tab) {
      return tab
    }
  }
  return null
}

export function checklistTargetForSession(sessionId: string): {
  tab: Tab
  target: RuntimeClientTarget
} | null {
  const state = useAppStore.getState()
  const tab = findChatTabBySessionId(state, sessionId)
  const target = tab ? structuredAgentSessionTargetForTab(state, tab) : null
  return tab && target ? { tab, target } : null
}

/** Progress of each session read so far: undefined while unread, null for a session with no list. */
export function useSessionChecklistProgress(): {
  progressBySession: Readonly<Record<string, SessionChecklistProgress | null>>
  request: (sessionIds: readonly string[]) => void
} {
  const [progressBySession, setProgressBySession] = useState<
    Record<string, SessionChecklistProgress | null>
  >({})
  const requested = useRef(new Set<string>())
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const request = useCallback((sessionIds: readonly string[]) => {
    for (const sessionId of sessionIds) {
      const owner = checklistTargetForSession(sessionId)
      if (!owner || requested.current.has(sessionId)) {
        continue
      }
      requested.current.add(sessionId)
      void readSessionChecklistProgress(owner.target, sessionId).then((progress) => {
        // Why: the reader caches for a short while, so a later request re-reads once it goes stale.
        requested.current.delete(sessionId)
        if (mounted.current) {
          setProgressBySession((current) => ({ ...current, [sessionId]: progress }))
        }
      })
    }
  }, [])
  return { progressBySession, request }
}

/**
 * The session a Checklist tab shows: the one picked by hand while pinned, otherwise the default for
 * the focus (prototype set, then chat in focus, then most recent), which moves as the focus does.
 */
export function useFloatingChecklistSession(tabId: string): {
  sessionId: string | null
  pinned: boolean
  progressBySession: Readonly<Record<string, SessionChecklistProgress | null>>
  requestProgress: (sessionIds: readonly string[]) => void
} {
  const pinnedSessionId = useFloatingChecklistPinStore((s) => s.pinnedSessionByTabId[tabId] ?? null)
  const prototype = usePrototypeViewStore((s) => s.focusedSetSessions)
  const chatInFocus = useAppStore(selectChatInFocusSessionId)
  const unifiedTabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)
  const recentSessionIds = useMemo(
    () => selectRecentChatSessionIds({ unifiedTabsByWorktree }),
    [unifiedTabsByWorktree]
  )
  const { progressBySession, request } = useSessionChecklistProgress()

  const following = pinnedSessionId === null
  useEffect(() => {
    if (!following) {
      return
    }
    const wanted = [prototype?.sessionId, prototype?.originSessionId].filter(
      (id): id is string => typeof id === 'string'
    )
    if (chatInFocus === null) {
      wanted.push(...recentSessionIds.slice(0, RECENT_SESSIONS_TO_READ))
    }
    request(wanted)
  }, [following, prototype, chatInFocus, recentSessionIds, request])

  const followed = resolveFollowedChecklistSession({
    prototype,
    chatInFocus,
    recentSessionIds,
    hasChecklist: (sessionId) => progressBySession[sessionId] != null
  })
  const resolved = followedOrPinnedChecklistSession(pinnedSessionId, followed)
  return { ...resolved, progressBySession, requestProgress: request }
}
