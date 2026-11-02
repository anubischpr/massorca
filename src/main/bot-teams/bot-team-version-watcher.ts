import { randomUUID } from 'node:crypto'
import {
  foldAgentSessionStatusEvent,
  type AgentSessionStatusSnapshot
} from '../../shared/agent-session-status-snapshot-fold'
import type { AgentSessionStatusEvent } from '../../shared/agent-session-wire'
import { botTeamTaskStatus } from '../../shared/bot-team-task-status'

type StatusHost = {
  subscribeStatus: (subscriber: {
    id: string
    emit: (event: AgentSessionStatusEvent) => void
  }) => () => void
}

/** Tells when a session turns from running to done, on the host's own status feed. */
export function watchBotTeamTaskFinishes(
  host: StatusHost,
  onFinished: (sessionId: string) => void
): () => void {
  let known: AgentSessionStatusSnapshot = new Map()
  return host.subscribeStatus({
    id: `bot-team-versions-${randomUUID()}`,
    emit: (event) => {
      const next = foldAgentSessionStatusEvent(known, event)
      // Only a change seen live counts: the opening snapshot replays what ended long ago.
      if (event.type === 'status') {
        const before = known.get(event.session.sessionId)
        const wasRunning =
          before !== undefined && before.status !== 'idle' && before.status !== null
        if (wasRunning && botTeamTaskStatus('session', event.session) === 'Done') {
          onFinished(event.session.sessionId)
        }
      }
      known = next
    }
  })
}
