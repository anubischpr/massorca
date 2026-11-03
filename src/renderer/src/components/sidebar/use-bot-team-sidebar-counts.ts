import { useEffect } from 'react'
import { toast } from 'sonner'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import {
  botTeamRoomCountsKey,
  loadBotTeamRoomCounts,
  useBotTeamRoomCountsStore
} from './bot-team-sidebar-counts'

/** The open team's counts; until `known`, they are empty and must not be read as zero. */
export type OpenTeamCounts = {
  known: boolean
  tasks: BotTeamTask[]
  projects: BotTeamProject[]
  projectTasks: BotTeamTask[]
  sharedProjects: boolean
}

const UNANSWERED: Omit<OpenTeamCounts, 'known'> = {
  tasks: [],
  projects: [],
  projectTasks: [],
  sharedProjects: false
}

/**
 * The team's last answer, shown at once on a switch back, and asked again whenever `refresh`
 * changes, so a project made or a task started shows without a reload.
 */
export function useOpenTeamCounts(teamId: string, refresh: string): OpenTeamCounts {
  const host = useBotTeamHost()
  const answer = useBotTeamRoomCountsStore(
    (state) => state.answers[botTeamRoomCountsKey(host, teamId)]
  )
  useEffect(() => {
    void loadBotTeamRoomCounts(teamId, { fresh: true }).catch((error: unknown) =>
      toast.error(String(error))
    )
  }, [host, teamId, refresh])
  return answer ? { known: true, ...answer } : { known: false, ...UNANSWERED }
}
