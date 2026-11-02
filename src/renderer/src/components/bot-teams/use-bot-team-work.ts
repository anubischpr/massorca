import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listBotTeamRoom } from '@/runtime/runtime-bot-team-client'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'

/** `refresh` lists again whenever it changes. */
export function useTeamWork(
  teamId: string,
  refresh?: string
): {
  tasks: BotTeamTask[]
  projects: BotTeamProject[]
} {
  const [work, setWork] = useState<{ tasks: BotTeamTask[]; projects: BotTeamProject[] }>({
    tasks: [],
    projects: []
  })
  useEffect(() => {
    let closed = false
    void listBotTeamRoom(teamId).then(
      ({ tasks, projects }) => {
        if (!closed) {
          // A host from before projects lists none.
          setWork({ tasks, projects: projects ?? [] })
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
