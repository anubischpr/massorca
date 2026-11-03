import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listBotTeamRoom } from '@/runtime/runtime-bot-team-client'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import { keepTeamWork, keptTeamWork } from './bot-team-project-board-cache'

export type TeamProjectWork = {
  tasks: BotTeamTask[]
  /** Owned and linked projects, archived ones included: the reader decides what to show. */
  projects: BotTeamProject[]
  /** Tasks other teams filed in this team's projects. */
  projectTasks: BotTeamTask[]
  /** False while unread, and on a host from before shared projects (it sends no linked teams). */
  sharedProjects: boolean
}

const NOTHING: TeamProjectWork = {
  tasks: [],
  projects: [],
  projectTasks: [],
  sharedProjects: false
}

/**
 * Like `useTeamWork`, plus the shared and archived projects; `refresh` lists again when it changes.
 * The last list stays kept per team, so a remount paints it before the refreshed list lands.
 */
export function useTeamProjectWork(teamId: string, refresh?: string): TeamProjectWork {
  const [work, setWork] = useState<TeamProjectWork>(() => keptTeamWork(teamId) ?? NOTHING)
  useEffect(() => {
    let closed = false
    void listBotTeamRoom(teamId, { includeArchived: true }).then(
      ({ tasks, projects, projectTasks }) => {
        if (!closed) {
          const listed = projects ?? []
          const next: TeamProjectWork = {
            tasks,
            projects: listed,
            projectTasks: projectTasks ?? [],
            sharedProjects: listed.every((project) => project.linkedTeamIds !== undefined)
          }
          keepTeamWork(teamId, next)
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
