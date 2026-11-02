import { useEffect, useState } from 'react'
import { listBotTeamFiles } from '@/runtime/runtime-bot-team-client'

/** The paths of the team's folder, listed on its host each time `wanted` turns on. */
export function useBotTeamFilePaths(teamId: string, wanted: boolean): string[] {
  const [paths, setPaths] = useState<string[]>([])
  useEffect(() => {
    if (!wanted) {
      return
    }
    let closed = false
    void listBotTeamFiles(teamId).then(
      (listed) => {
        if (!closed && listed !== 'unavailable') {
          setPaths(listed.files.map((file) => file.relativePath))
        }
      },
      // The list only helps typing; a host out of reach leaves the bots to mention.
      () => {}
    )
    return () => {
      closed = true
    }
  }, [teamId, wanted])
  return paths
}
