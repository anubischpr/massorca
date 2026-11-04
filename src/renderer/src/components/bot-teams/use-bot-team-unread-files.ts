import { useEffect, useState } from 'react'
import { listBotTeamFiles } from '@/runtime/runtime-bot-team-client'
import { listBotTeamProjectFiles } from '@/runtime/runtime-bot-team-client-project-files'
import { unseenBotTeamFiles, useBotTeamSeenFilesStore } from './bot-team-file-read-state'
import { listedBotTeamFileKeys } from './bot-team-file-source'
import { isBotTeamFileVisible } from './bot-team-file-visibility'

// Why a minute: each refresh lists the team's linked-project worktrees with git on the host.
const REFRESH_MS = 60_000

/**
 * How many of a team's files the person has not opened yet, across its own folder and its linked
 * projects. The first listing of a team counts what is there as seen.
 */
export function useBotTeamUnreadFileCount(teamId: string): number {
  const [keys, setKeys] = useState<readonly string[] | null>(null)
  const seen = useBotTeamSeenFilesStore((state) => state.seen[teamId])
  const seedTeam = useBotTeamSeenFilesStore((state) => state.seedTeam)
  useEffect(() => {
    let closed = false
    const refresh = (): void => {
      void Promise.all([
        listBotTeamFiles(teamId),
        listBotTeamProjectFiles(teamId).catch((): 'unavailable' => 'unavailable')
      ]).then(
        ([listed, linked]) => {
          if (closed) {
            return
          }
          const teamPaths = (listed === 'unavailable' ? [] : listed.files)
            .map((file) => file.relativePath)
            .filter((relativePath) => isBotTeamFileVisible(relativePath))
          const projectFiles = (linked === 'unavailable' ? [] : linked.projects)
            .flatMap((section) => section.files)
            .filter((file) => isBotTeamFileVisible(file.relativePath))
          const all = listedBotTeamFileKeys(teamPaths, projectFiles)
          seedTeam(teamId, all)
          setKeys(all)
        },
        // A host out of reach leaves the dot as it was: the list only adds a hint.
        () => {}
      )
    }
    refresh()
    const timer = window.setInterval(refresh, REFRESH_MS)
    return () => {
      closed = true
      window.clearInterval(timer)
    }
  }, [teamId, seedTeam])
  return keys === null ? 0 : unseenBotTeamFiles(keys, seen).length
}
