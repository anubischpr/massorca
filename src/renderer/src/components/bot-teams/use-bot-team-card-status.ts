import { useEffect, useState } from 'react'
import { listBotTeamRoom } from '@/runtime/runtime-bot-team-client'
import {
  botTeamOverallStatus,
  type BotTeamOverallStatus
} from '../../../../shared/bot-team-overall-status'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'

/** Each team's current state, from its tasks and the host's live session status. */
export function useBotTeamCardStatus(
  teams: readonly BotTeam[]
): (teamId: string) => BotTeamOverallStatus {
  const statuses = useBotTeamSessionStatuses()
  const [tasksByTeam, setTasksByTeam] = useState<Record<string, BotTeamTask[]>>({})
  const ids = teams.map((team) => team.id).join(',')
  useEffect(() => {
    let closed = false
    for (const teamId of ids ? ids.split(',') : []) {
      void listBotTeamRoom(teamId).then(
        ({ tasks }) => {
          if (!closed) {
            setTasksByTeam((current) => ({ ...current, [teamId]: tasks }))
          }
        },
        () => {}
      )
    }
    return () => {
      closed = true
    }
  }, [ids])
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
