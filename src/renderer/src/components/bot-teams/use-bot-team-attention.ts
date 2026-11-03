import { useEffect } from 'react'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import { botTeamTaskStatus } from '../../../../shared/bot-team-task-status'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import {
  botTeamRoomCountsKey,
  loadBotTeamRoomCounts,
  useBotTeamRoomCountsStore
} from '../sidebar/bot-team-sidebar-counts'
import { useBotTeamSessionStatuses } from './use-bot-team-task-status'

const TASKS_CHECK_MS = 20_000

/** Whether any task of a team waits for the person, from the host's live session status. */
export function useBotTeamAttention(teams: readonly BotTeam[]): (teamId: string) => boolean {
  const statuses = useBotTeamSessionStatuses()
  const host = useBotTeamHost()
  // Rereads whenever a team's room answers, so a task that starts or waits shows at the next check.
  const answers = useBotTeamRoomCountsStore((state) => state.answers)
  const ids = teams.map((team) => team.id).join(',')
  useEffect(() => {
    const load = (): void => {
      for (const teamId of ids ? ids.split(',') : []) {
        // Joins a request already in flight; a failed check keeps the last answer.
        void loadBotTeamRoomCounts(teamId).catch(() => {})
      }
    }
    load()
    // Tasks start without the sidebar being told; the status feed alone cannot name them.
    const timer = window.setInterval(load, TASKS_CHECK_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [host, ids])
  return (teamId) =>
    (answers[botTeamRoomCountsKey(host, teamId)]?.tasks ?? []).some(
      (task) =>
        task.sessionId !== null &&
        botTeamTaskStatus(task.sessionId, statuses.get(task.sessionId)) === 'Waiting for you'
    )
}
