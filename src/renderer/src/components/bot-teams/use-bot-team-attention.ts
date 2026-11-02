import { useEffect, useState } from 'react'
import { listBotTeamRoom } from '@/runtime/runtime-bot-team-client'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'

const TASKS_CHECK_MS = 20_000

/** Whether any task of a team waits for the person, from the host's live session status. */
export function useBotTeamAttention(teams: readonly BotTeam[]): (teamId: string) => boolean {
  const statuses = useBotTeamSessionStatuses()
  const [tasksByTeam, setTasksByTeam] = useState<Record<string, BotTeamTask[]>>({})
  const ids = teams.map((team) => team.id).join(',')
  useEffect(() => {
    let closed = false
    const load = (): void => {
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
    }
    load()
    // Tasks start without the sidebar being told; the status feed alone cannot name them.
    const timer = window.setInterval(load, TASKS_CHECK_MS)
    return () => {
      closed = true
      window.clearInterval(timer)
    }
  }, [ids])
  return (teamId) =>
    (tasksByTeam[teamId] ?? []).some(
      (task) =>
        task.sessionId !== null &&
        botTeamTaskStatus(task.sessionId, statuses.get(task.sessionId)) === 'Waiting for you'
    )
}
