import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import { listBotTeams } from '@/runtime/runtime-bot-team-client'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

const HOST_CHECK_MS = 20_000

export type BotTeamsState = {
  /** Null until the host answers for the first time. */
  teams: BotTeam[] | null
  failed: boolean
  /** When the host last answered, to say how old what is on screen is once it stops. */
  lastSeenAt: number | null
  reload: () => void
  /** Runs a change on the host, then shows the team it returned; a refusal becomes a toast. */
  applyChange: (change: () => Promise<unknown>) => Promise<boolean>
}

export function useBotTeams(): BotTeamsState {
  const host = useBotTeamHost()
  const [teams, setTeams] = useState<BotTeam[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null)

  const reload = useCallback(() => {
    void listBotTeams().then(
      (listed) => {
        setTeams(listed)
        setFailed(false)
        setLastSeenAt(Date.now())
      },
      () => setFailed(true)
    )
    // The host is read inside the client; a change of host must list again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])

  // Another host's teams are not these: show nothing until it answers.
  useEffect(() => {
    setTeams(null)
    setLastSeenAt(null)
    reload()
    const timer = window.setInterval(reload, HOST_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  const applyChange = useCallback(
    async (change: () => Promise<unknown>) => {
      try {
        await change()
        reload()
        return true
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
        return false
      }
    },
    [reload]
  )

  return { teams, failed, lastSeenAt, reload, applyChange }
}
