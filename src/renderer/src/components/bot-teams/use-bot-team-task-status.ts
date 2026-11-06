import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { getStructuredAgentSessionStatusFeed } from '@/runtime/structured-agent-session-status-feed'
import { botTeamHostTarget, useBotTeamHost } from '@/runtime/bot-team-host'
import type { AgentSessionStatusSnapshot } from '../../../../shared/agent-session-status-snapshot-fold'

/**
 * The host's live status per session, the same feed the dashboard reads. The shared feed owner
 * reconnects when the stream drops, so a room never stays on "Checking status".
 */
export function useBotTeamSessionStatuses(): AgentSessionStatusSnapshot {
  const host = useBotTeamHost()
  const feed = useMemo(() => getStructuredAgentSessionStatusFeed(botTeamHostTarget(host)), [host])
  useEffect(() => feed.activate(), [feed])
  return useSyncExternalStore(feed.subscribe, feed.getSnapshot)
}
