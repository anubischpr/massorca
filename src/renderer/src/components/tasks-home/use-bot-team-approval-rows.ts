import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { listBotTeamRoom, listBotTeams } from '@/runtime/runtime-bot-team-client'
import { useBotTeamIdsKey } from '../bot-teams/use-bot-teams'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { useBotTeamSessionStatuses } from '../bot-teams/use-bot-team-task-status'
import { deriveBotTeamApprovalRows, type BotTeamApprovalRow } from './tasks-home-bot-team-approvals'

type LoadedTeams = { teams: BotTeam[]; tasksByTeamId: Record<string, BotTeamTask[]> }

const NOTHING_LOADED: LoadedTeams = { teams: [], tasksByTeamId: {} }

/**
 * Bot Team tasks waiting for the person. Teams and tasks come from the connected host through
 * the runtime client, so a remote or paired host answers the same way; a host that cannot
 * answer adds no rows.
 */
export function useBotTeamApprovalRows(): BotTeamApprovalRow[] {
  const environmentId = useAppStore((s) => s.settings?.activeRuntimeEnvironmentId ?? null)
  const statuses = useBotTeamSessionStatuses()
  const [loaded, setLoaded] = useState<LoadedTeams>(NOTHING_LOADED)
  // A task that starts adds a session to the feed, so the task list is read again then.
  const sessionCount = statuses.size
  // A team removed on another surface takes its rows with it.
  const teamIdsKey = useBotTeamIdsKey()

  useEffect(() => {
    let active = true
    const load = (): void => {
      void listBotTeams()
        .then(async (teams) => {
          const rooms = await Promise.all(
            teams.map(async (team) => [team.id, (await listBotTeamRoom(team.id)).tasks] as const)
          )
          if (active) {
            setLoaded({ teams, tasksByTeamId: Object.fromEntries(rooms) })
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
  }, [environmentId, sessionCount, teamIdsKey])

  return useMemo(() => deriveBotTeamApprovalRows({ ...loaded, statuses }), [loaded, statuses])
}
