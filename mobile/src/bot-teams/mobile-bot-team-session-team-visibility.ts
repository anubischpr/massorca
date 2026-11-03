import { useSyncExternalStore } from 'react'
import { isBotTeamFolderPath } from '../../../src/shared/bot-team-folder'
import type { BotTeamSessionTeamsResult } from '../../../src/shared/rpc-contract/bot-team-session-team-params'
import { botTeamForPaneKey } from './mobile-bot-team-session-team'

type SessionTeamMap = BotTeamSessionTeamsResult['sessionTeams']

type BotTeamVisibility = {
  /** The desktop's "Show bot teams" switch, mirrored here so every row reads one answer. */
  showBotTeamWorkspaces: boolean
  /** The host's bot-team sessions; empty until the first read lands. */
  sessionTeams: SessionTeamMap
}

let visibility: BotTeamVisibility = { showBotTeamWorkspaces: false, sessionTeams: {} }
const listeners = new Set<() => void>()

function publish(next: Partial<BotTeamVisibility>): void {
  visibility = { ...visibility, ...next }
  for (const listener of listeners) {
    listener()
  }
}

export function setMobileBotTeamShown(showBotTeamWorkspaces: boolean): void {
  if (visibility.showBotTeamWorkspaces !== showBotTeamWorkspaces) {
    publish({ showBotTeamWorkspaces })
  }
}

export function setMobileBotTeamSessionTeams(sessionTeams: SessionTeamMap): void {
  publish({ sessionTeams })
}

export function getMobileBotTeamVisibility(): BotTeamVisibility {
  return visibility
}

export function useMobileBotTeamVisibility(): BotTeamVisibility {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => visibility,
    () => visibility
  )
}

type WorktreeLike = {
  path: string
  isMainWorktree?: boolean
  agents?: readonly { paneKey: string }[]
}

/**
 * Whether a row belongs to Bot teams mode: a team's folder, or a worktree whose every listed session
 * is a team's. A session listed under a parent may run elsewhere, so one team session alone does not
 * hide a user's worktree. The main checkout never counts, since it is the project's own row.
 */
export function isMobileBotTeamWorktree(
  worktree: WorktreeLike,
  sessionTeams: SessionTeamMap
): boolean {
  if (isBotTeamFolderPath(worktree.path)) {
    return true
  }
  if (worktree.isMainWorktree) {
    return false
  }
  const agents = worktree.agents ?? []
  return (
    agents.length > 0 &&
    agents.every((agent) => botTeamForPaneKey(sessionTeams, agent.paneKey) !== undefined)
  )
}
