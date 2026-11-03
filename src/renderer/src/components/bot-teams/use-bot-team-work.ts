import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listBotTeamRoom } from '@/runtime/runtime-bot-team-client'
import {
  keepTeamTaskList,
  keptTeamTaskList,
  type TeamTaskList
} from './bot-team-project-board-cache'

const NOTHING: TeamTaskList = { tasks: [], projects: [] }

/** `refresh` lists again whenever it changes. */
export function useTeamWork(teamId: string, refresh?: string): TeamTaskList {
  return useListedTeamWork(teamId, refresh, NOTHING)
}

/**
 * The team board's list: it paints the list kept for the team first, then the refreshed one.
 * Other readers start empty, since an editor seeded from an older list would keep it.
 */
export function useKeptTeamWork(teamId: string): TeamTaskList {
  return useListedTeamWork(teamId, undefined, keptTeamTaskList(teamId) ?? NOTHING)
}

function useListedTeamWork(
  teamId: string,
  refresh: string | undefined,
  initial: TeamTaskList
): TeamTaskList {
  const [work, setWork] = useState<TeamTaskList>(initial)
  useEffect(() => {
    let closed = false
    void listBotTeamRoom(teamId).then(
      ({ tasks, projects }) => {
        if (!closed) {
          // A host from before projects lists none.
          const next: TeamTaskList = { tasks, projects: projects ?? [] }
          keepTeamTaskList(teamId, next)
          setWork(next)
        }
      },
      (error: unknown) => toast.error(String(error))
    )
    return () => {
      closed = true
    }
  }, [teamId, refresh])
  return work
}
