import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listBotTeams } from '@/runtime/runtime-bot-team-client'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

export type BotTeamsState = {
  /** Null until the host answers for the first time. */
  teams: BotTeam[] | null
  failed: boolean
  reload: () => void
  /** Runs a change on the host, then shows the team it returned; a refusal becomes a toast. */
  applyChange: (change: () => Promise<unknown>) => Promise<boolean>
}

export function useBotTeams(): BotTeamsState {
  const [teams, setTeams] = useState<BotTeam[] | null>(null)
  const [failed, setFailed] = useState(false)

  const reload = useCallback(() => {
    void listBotTeams().then(
      (listed) => {
        setTeams(listed)
        setFailed(false)
      },
      () => setFailed(true)
    )
  }, [])

  useEffect(reload, [reload])

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

  return { teams, failed, reload, applyChange }
}
