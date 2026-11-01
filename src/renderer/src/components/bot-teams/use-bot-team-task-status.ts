import { useEffect, useState } from 'react'
import { subscribeStructuredAgentSessionStatus } from '@/runtime/structured-agent-session-client'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import { useAppStore } from '@/store'
import {
  foldAgentSessionStatusEvent,
  type AgentSessionStatusSnapshot
} from '../../../../shared/agent-session-status-snapshot-fold'

/** The host's live status per session, the same feed the dashboard reads. */
export function useBotTeamSessionStatuses(): AgentSessionStatusSnapshot {
  const [snapshot, setSnapshot] = useState<AgentSessionStatusSnapshot>(() => new Map())
  useEffect(() => {
    let closed = false
    let unsubscribe: (() => void) | null = null
    void subscribeStructuredAgentSessionStatus(
      getActiveRuntimeTarget(useAppStore.getState().settings),
      (event) => setSnapshot((current) => foldAgentSessionStatusEvent(current, event)),
      () => {},
      () => {}
    ).then(
      (subscription) => {
        if (closed) {
          subscription.unsubscribe()
        } else {
          unsubscribe = subscription.unsubscribe
        }
      },
      () => {}
    )
    return () => {
      closed = true
      unsubscribe?.()
    }
  }, [])
  return snapshot
}
