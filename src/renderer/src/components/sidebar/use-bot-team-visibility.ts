import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  useBotTeamSessionTeams,
  type BotTeamSessionTeam
} from '../bot-teams/BotTeamSessionCharacter'
import {
  countAgentSessionTabs,
  publishBotTeamWorktreeIds,
  visibleSessionAgents,
  worktreeIdsHostingBotTeamSessions
} from './bot-team-workspace-visibility'

/** The worktrees that hold a bot team's session, kept current as session tabs come and go. */
export function useBotTeamWorktreeIds(): ReadonlySet<string> {
  const agentSessionTabCount = useAppStore((s) => countAgentSessionTabs(s.unifiedTabsByWorktree ?? {}))
  const sessionTeams = useBotTeamSessionTeams(agentSessionTabCount)
  // Why useShallow: a tab write that leaves the same worktrees holding team sessions must not re-key the visible-list memo.
  const worktreeIds = useAppStore(
    useShallow((s) => [...worktreeIdsHostingBotTeamSessions(s.unifiedTabsByWorktree ?? {}, sessionTeams)])
  )
  const worktreeIdSet = useMemo(() => new Set(worktreeIds), [worktreeIds])
  useEffect(() => {
    publishBotTeamWorktreeIds(worktreeIdSet)
  }, [worktreeIdSet])
  return worktreeIdSet
}

/** A worktree's session rows, without a team's sessions while "Show bot teams" is off. */
export function useVisibleSessionAgents<T extends { tab: { id: string } }>(
  allAgents: readonly T[],
  botTeamByTabId: Readonly<Record<string, BotTeamSessionTeam>>
): T[] {
  const showBotTeamWorkspaces = useAppStore((s) => s.showBotTeamWorkspaces)
  return useMemo(
    () => visibleSessionAgents(allAgents, botTeamByTabId, showBotTeamWorkspaces),
    [allAgents, botTeamByTabId, showBotTeamWorkspaces]
  )
}
