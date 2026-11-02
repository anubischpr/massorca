import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'
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

type BotTeamsList = Pick<BotTeamsState, 'teams' | 'failed' | 'lastSeenAt'>

const NOTHING_LISTED: BotTeamsList = { teams: null, failed: false, lastSeenAt: null }
const useBotTeamsStore = create<BotTeamsList>(() => NOTHING_LISTED)

let listedHost: string | null = null
let surfaces = 0
let timer: number | undefined
let latestAsk = 0

function reloadBotTeams(): void {
  const ask = ++latestAsk
  void listBotTeams().then(
    (teams) => {
      // Only the newest answer counts: an older one could bring back a team just deleted.
      if (ask === latestAsk) {
        useBotTeamsStore.setState({ teams, failed: false, lastSeenAt: Date.now() })
      }
    },
    () => {
      if (ask === latestAsk) {
        useBotTeamsStore.setState({ failed: true })
      }
    }
  )
}

function openSurface(host: string): void {
  surfaces += 1
  if (host !== listedHost) {
    listedHost = host
    // Another host's teams are not these: show nothing until it answers.
    useBotTeamsStore.setState(NOTHING_LISTED)
    reloadBotTeams()
  }
  timer ??= window.setInterval(reloadBotTeams, HOST_CHECK_MS)
}

function closeSurface(): void {
  surfaces -= 1
  if (surfaces > 0) {
    return
  }
  window.clearInterval(timer)
  timer = undefined
  listedHost = null
  latestAsk += 1
  useBotTeamsStore.setState(NOTHING_LISTED)
}

/** The list every Bot teams surface shares, so a change made on one shows on all at once. */
export function useBotTeams(): BotTeamsState {
  const host = useBotTeamHost()
  const teams = useBotTeamsStore((state) => state.teams)
  const failed = useBotTeamsStore((state) => state.failed)
  const lastSeenAt = useBotTeamsStore((state) => state.lastSeenAt)

  useEffect(() => {
    openSurface(host)
    return closeSurface
  }, [host])

  const applyChange = useCallback(async (change: () => Promise<unknown>) => {
    try {
      await change()
      reloadBotTeams()
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return false
    }
  }, [])

  return { teams, failed, lastSeenAt, reload: reloadBotTeams, applyChange }
}

/** Changes when a team is added or removed, for a reader that keeps its own copy of team data. */
export function useBotTeamIdsKey(): string {
  return useBotTeamsStore((state) => (state.teams ?? []).map((team) => team.id).join(','))
}
