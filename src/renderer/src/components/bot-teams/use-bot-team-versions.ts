import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listBotTeamVersions } from '@/runtime/runtime-bot-team-client'
import type { BotTeamVersionsResult } from '../../../../shared/rpc-contract/bot-team-version-params'

/** The team's versions: null while loading, 'unavailable' on a host that cannot keep any. */
export function useBotTeamVersions(teamId: string): {
  state: BotTeamVersionsResult | 'unavailable' | null
  reload: () => void
} {
  const [state, setState] = useState<BotTeamVersionsResult | 'unavailable' | null>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    let closed = false
    void listBotTeamVersions(teamId).then(
      (listed) => {
        if (!closed) {
          setState(listed)
        }
      },
      (error: unknown) => {
        if (!closed) {
          toast.error(error instanceof Error ? error.message : String(error))
        }
      }
    )
    return () => {
      closed = true
    }
  }, [teamId, round])
  const reload = useCallback(() => setRound((current) => current + 1), [])
  return { state, reload }
}
