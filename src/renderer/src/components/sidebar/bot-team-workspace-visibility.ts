import { isBotTeamFolderPath, isBotTeamFolderShown } from '../../../../shared/bot-team-folder'
import {
  botTeamByTabIdFrom,
  type BotTeamSessionTeamMap
} from '../bot-teams/BotTeamSessionCharacter'

type TabLike = { id: string; contentType: string; entityId: string }

/**
 * Whether a folder path shows in Workspaces. Only a team's folder is gated: it needs
 * "Show bot teams" on and its team's own Workspaces option on.
 */
export function isBotTeamFolderVisibleInWorkspaces(
  workspacePath: string,
  workspacesOnTeamIds: ReadonlySet<string>,
  showBotTeams: boolean
): boolean {
  if (!isBotTeamFolderPath(workspacePath)) {
    return true
  }
  return showBotTeams && isBotTeamFolderShown(workspacePath, workspacesOnTeamIds)
}

/** Worktrees that hold an agent-session tab a bot team started. Read from the task link, never a name. */
export function worktreeIdsHostingBotTeamSessions(
  unifiedTabsByWorktree: Readonly<Record<string, readonly TabLike[]>>,
  sessionTeams: BotTeamSessionTeamMap
): ReadonlySet<string> {
  const botTeamByTabId = botTeamByTabIdFrom(unifiedTabsByWorktree, sessionTeams)
  const worktreeIds = new Set<string>()
  for (const [worktreeId, tabs] of Object.entries(unifiedTabsByWorktree)) {
    if (tabs.some((tab) => botTeamByTabId[tab.id] !== undefined)) {
      worktreeIds.add(worktreeId)
    }
  }
  return worktreeIds
}

/** The session rows a worktree keeps: a team's session is dropped while "Show bot teams" is off. */
export function visibleSessionAgents<T extends { tab: { id: string } }>(
  agents: readonly T[],
  botTeamByTabId: Readonly<Record<string, unknown>>,
  showBotTeams: boolean
): T[] {
  if (showBotTeams) {
    return [...agents]
  }
  return agents.filter((agent) => botTeamByTabId[agent.tab.id] === undefined)
}

export function countAgentSessionTabs(
  unifiedTabsByWorktree: Readonly<Record<string, readonly TabLike[]>>
): number {
  let count = 0
  for (const tabs of Object.values(unifiedTabsByWorktree)) {
    for (const tab of tabs) {
      if (tab.contentType === 'agent-session') {
        count += 1
      }
    }
  }
  return count
}

// Why: Cmd+J and Cmd+1–9 filter outside React, so the sidebar publishes the worktrees bot tasks made.
const EMPTY_WORKTREE_IDS: ReadonlySet<string> = new Set()
let publishedBotTeamWorktreeIds: ReadonlySet<string> = EMPTY_WORKTREE_IDS

export function getPublishedBotTeamWorktreeIds(): ReadonlySet<string> {
  return publishedBotTeamWorktreeIds
}

export function publishBotTeamWorktreeIds(ids: ReadonlySet<string>): void {
  publishedBotTeamWorktreeIds = ids
}
