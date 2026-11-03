import { useEffect, useMemo, useState } from 'react'
import { listBotTeamRoom, listBotTeams } from '@/runtime/runtime-bot-team-client'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { useBotTeamSessionStatuses } from '../bot-teams/use-bot-team-task-status'
import { deriveBotTeamApprovalRows, type BotTeamApprovalRow } from './tasks-home-bot-team-approvals'

type LoadedTeams = {
  /** The host these teams were read from; teams of another host are never paired with this one's statuses. */
  host: string
  teams: BotTeam[]
  tasksByTeamId: Record<string, BotTeamTask[]>
}

const NOTHING_LOADED: LoadedTeams = { host: '', teams: [], tasksByTeamId: {} }

/** One team's tasks; a room that cannot be read adds none, and the other teams still count. */
function readRoomTasks(teamId: string): Promise<BotTeamTask[]> {
  return listBotTeamRoom(teamId).then(
    (room) => room.tasks,
    () => []
  )
}

/**
 * Bot Team tasks waiting for the person. Teams and tasks come from the connected host through
 * the runtime client, so a remote or paired host answers the same way; a host that cannot
 * answer adds no rows.
 */
export function useBotTeamApprovalRows(): BotTeamApprovalRow[] {
  // Why: teams are read from this same host, so switching host must read them again.
  const host = useBotTeamHost()
  const statuses = useBotTeamSessionStatuses()
  const [loaded, setLoaded] = useState<LoadedTeams>(NOTHING_LOADED)
  // A task that starts adds a session to the feed, so the task list is read again then.
  const sessionCount = statuses.size

  useEffect(() => {
    let active = true
    const load = (): void => {
      void listBotTeams()
        .then(async (teams) => {
          const rooms = await Promise.all(
            teams.map(async (team) => [team.id, await readRoomTasks(team.id)] as const)
          )
          if (active) {
            setLoaded({ host, teams, tasksByTeamId: Object.fromEntries(rooms) })
          }
        })
        .catch(() => {
          if (active) {
            setLoaded(NOTHING_LOADED)
          }
        })
    }
    load()
    window.addEventListener('focus', load)
    return () => {
      active = false
      window.removeEventListener('focus', load)
    }
  }, [host, sessionCount])

  const shown = loaded.host === host ? loaded : NOTHING_LOADED
  return useMemo(
    () =>
      deriveBotTeamApprovalRows({
        teams: shown.teams,
        tasksByTeamId: shown.tasksByTeamId,
        statuses
      }),
    [shown, statuses]
  )
}
