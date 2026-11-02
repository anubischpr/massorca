import { useEffect, useMemo, useState } from 'react'
import { botTeamTaskStatus, type BotTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { mobileStructuredSessionStatusFeed } from '../session/mobile-structured-session-status-feed'
import type { RpcClient } from '../transport/rpc-client'

/** A task's status from the host's live session feed, read the same way on every Bot teams screen. */
export function useMobileBotTeamTaskStatus(
  client: RpcClient
): (task: BotTeamTask) => BotTeamTaskStatus {
  const feed = useMemo(() => mobileStructuredSessionStatusFeed(client), [client])
  const [, setRevision] = useState(0)
  useEffect(() => feed.subscribe(() => setRevision((revision) => revision + 1)), [feed])
  const statuses = feed.getSnapshot()
  return (task) =>
    botTeamTaskStatus(
      task.sessionId,
      task.sessionId === null ? undefined : statuses.get(task.sessionId)
    )
}
