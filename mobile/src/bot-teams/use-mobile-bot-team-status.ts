import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { mobileStructuredSessionStatusFeed } from '../session/mobile-structured-session-status-feed'
import type { RpcClient } from '../transport/rpc-client'
import {
  botTeamOverallStatus,
  type BotTeamOverallStatus
} from '../../../src/shared/bot-team-overall-status'
import { botTeamTaskStatus } from '../../../src/shared/bot-team-task-status'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../src/shared/rpc-contract/bot-team-room-params'
import { listMobileBotTeamRoom } from './mobile-bot-team-room-rpc'

const TASKS_CHECK_MS = 20_000

/** Each team's current state, from its tasks and the host's live session status. */
export function useMobileBotTeamStatus(
  client: RpcClient,
  teams: readonly BotTeam[]
): (teamId: string) => BotTeamOverallStatus {
  const feed = useMemo(() => mobileStructuredSessionStatusFeed(client), [client])
  const subscribe = useCallback((listener: () => void) => feed.subscribe(listener), [feed])
  const read = useCallback(() => feed.getSnapshot(), [feed])
  const statuses = useSyncExternalStore(subscribe, read, read)
  const [tasksByTeam, setTasksByTeam] = useState<Record<string, BotTeamTask[]>>({})
  const ids = teams.map((team) => team.id).join(',')

  useEffect(() => {
    let closed = false
    const load = (): void => {
      for (const teamId of ids ? ids.split(',') : []) {
        void listMobileBotTeamRoom(client, teamId).then((room) => {
          if (room && !closed) {
            setTasksByTeam((current) => ({ ...current, [teamId]: room.tasks }))
          }
        })
      }
    }
    load()
    const timer = setInterval(load, TASKS_CHECK_MS)
    return () => {
      closed = true
      clearInterval(timer)
    }
  }, [client, ids])

  return (teamId) =>
    botTeamOverallStatus(
      (tasksByTeam[teamId] ?? []).map((task) =>
        botTeamTaskStatus(
          task.sessionId,
          task.sessionId === null ? undefined : statuses.get(task.sessionId)
        )
      )
    )
}
