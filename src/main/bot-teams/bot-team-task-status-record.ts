import { randomUUID } from 'node:crypto'
import type {
  AgentSessionStatusEvent,
  AgentSessionStatusSummary
} from '../../shared/agent-session-wire'
import {
  botTeamTaskStatus,
  isBotTeamTaskLastStatus,
  type BotTeamTaskLastStatus
} from '../../shared/bot-team-task-status'

type StatusHost = {
  subscribeStatus: (subscriber: {
    id: string
    emit: (event: AgentSessionStatusEvent) => void
  }) => () => void
}

/**
 * Keeps each session's terminal status for its task on the host's status feed, so the task's board
 * paints it before the feed answers. A session that works or waits clears it; an unanswered one is skipped.
 */
export function watchBotTeamTaskLastStatus(
  host: StatusHost,
  onStatus: (sessionId: string, status: BotTeamTaskLastStatus | null) => void
): () => void {
  const record = (session: AgentSessionStatusSummary): void => {
    const status = botTeamTaskStatus(session.sessionId, session)
    if (status === 'Unknown' || status === 'Not started') {
      return
    }
    try {
      onStatus(session.sessionId, isBotTeamTaskLastStatus(status) ? status : null)
    } catch (error) {
      // Why: keeping a status must never break the status feed the rest of the app reads.
      console.warn('[bot-teams] could not keep a task status', error)
    }
  }
  return host.subscribeStatus({
    id: `bot-team-task-status-${randomUUID()}`,
    emit: (event) => {
      if (event.type === 'snapshot') {
        for (const session of event.sessions) {
          record(session)
        }
      } else if (event.type === 'status') {
        record(event.session)
      }
    }
  })
}
