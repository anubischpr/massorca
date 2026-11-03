import React, { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import type { BotTeamSessionTeamsResult } from '../../../../shared/rpc-contract/bot-team-session-team-params'
import { listBotTeamSessionTeams } from '../../runtime/runtime-bot-team-session-team-client'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'

export type BotTeamSessionTeam = BotTeamSessionTeamsResult['sessionTeams'][string]
export type BotTeamSessionTeamMap = BotTeamSessionTeamsResult['sessionTeams']

/** The team's character, small, named after the team; a session no team started shows none. */
export function BotTeamSessionCharacter({
  sessionTeam
}: {
  sessionTeam: BotTeamSessionTeam | undefined
}): React.JSX.Element | null {
  if (!sessionTeam) {
    return null
  }
  return (
    <span className="inline-flex shrink-0" role="img" aria-label={sessionTeam.teamName}>
      <BotTeamCharacterIcon character={sessionTeam.character} size={12} still />
    </span>
  )
}

/** Joins each agent-session tab to its team through the tab's session id (`entityId`). */
export function botTeamByTabIdFrom(
  unifiedTabsByWorktree: Readonly<
    Record<string, readonly { id: string; contentType: string; entityId: string }[]>
  >,
  sessionTeams: BotTeamSessionTeamMap
): Record<string, BotTeamSessionTeam> {
  const byTabId: Record<string, BotTeamSessionTeam> = {}
  // Why: most hosts have no bot-team session, so the tab walk is skipped for them.
  if (Object.keys(sessionTeams).length === 0) {
    return byTabId
  }
  for (const tabs of Object.values(unifiedTabsByWorktree)) {
    for (const tab of tabs) {
      const team = tab.contentType === 'agent-session' ? sessionTeams[tab.entityId] : undefined
      if (team) {
        byTabId[tab.id] = team
      }
    }
  }
  return byTabId
}

/** The bot team behind each session tab on the host; empty until a bot team has a session. */
export function useBotTeamByTabId(
  sessionTeams: BotTeamSessionTeamMap
): Record<string, BotTeamSessionTeam> {
  const unifiedTabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)
  return useMemo(
    () => botTeamByTabIdFrom(unifiedTabsByWorktree, sessionTeams),
    [unifiedTabsByWorktree, sessionTeams]
  )
}

/** The host's bot-team sessions, reloaded whenever the caller's row set changes. */
export function useBotTeamSessionTeams(refreshKey: number): BotTeamSessionTeamMap {
  const [sessionTeams, setSessionTeams] = useState<BotTeamSessionTeamMap>({})
  useEffect(() => {
    let cancelled = false
    void listBotTeamSessionTeams().then((next) => {
      if (!cancelled) {
        setSessionTeams(next)
      }
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])
  return sessionTeams
}
