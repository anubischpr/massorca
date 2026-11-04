import { useEffect, useRef, useState } from 'react'
import type { AgentSessionStatusSummary } from '../../../../shared/agent-session-wire'
import { openBotTeamTaskCount, UNREPORTED_SESSION_GRACE_MS } from './open-bot-team-task-count'

/**
 * The open tasks of a team's room. A started session the live feed has not reported stays unknown,
 * and the count hidden, for the grace period; after it the session counts as open.
 */
export function useOpenBotTeamTaskCount(
  tasks: readonly { sessionId: string | null }[],
  statuses: ReadonlyMap<string, Pick<AgentSessionStatusSummary, 'status' | 'turnOutcome'>>
): number | null {
  // Why a string: a session that stays unreported keeps the same key, so its timer is not restarted.
  const unreported = tasks
    .flatMap((task) =>
      task.sessionId !== null && !statuses.has(task.sessionId) ? [task.sessionId] : []
    )
    .join(',')
  const [expired, setExpired] = useState<ReadonlySet<string>>(() => new Set())
  const timers = useRef(new Map<string, number>())
  useEffect(() => {
    const wanted = new Set(unreported === '' ? [] : unreported.split(','))
    for (const [sessionId, timer] of timers.current) {
      if (!wanted.has(sessionId)) {
        window.clearTimeout(timer)
        timers.current.delete(sessionId)
      }
    }
    for (const sessionId of wanted) {
      if (!timers.current.has(sessionId)) {
        const timer = window.setTimeout(() => {
          timers.current.delete(sessionId)
          setExpired((current) => new Set(current).add(sessionId))
        }, UNREPORTED_SESSION_GRACE_MS)
        timers.current.set(sessionId, timer)
      }
    }
  }, [unreported])
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) {
        window.clearTimeout(timer)
      }
      pending.clear()
    }
  }, [])
  return openBotTeamTaskCount(tasks, statuses, expired)
}
