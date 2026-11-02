/** A Workspaces project a bot project links to: a repo (git or folder) or a group of folder workspaces. */
export type BotTeamWorkspaceProjectRef = { type: 'repo' | 'group'; id: string }

const REPO_PREFIX = 'repo:'
const GROUP_PREFIX = 'group:'

export function botTeamRepoProjectKey(repoId: string): string {
  return `${REPO_PREFIX}${repoId}`
}

export function botTeamGroupProjectKey(groupId: string): string {
  return `${GROUP_PREFIX}${groupId}`
}

/** The project a link key names, or null for a legacy worktree or folder-workspace key. */
export function parseBotTeamProjectKey(key: string): BotTeamWorkspaceProjectRef | null {
  for (const [prefix, type] of [
    [REPO_PREFIX, 'repo'],
    [GROUP_PREFIX, 'group']
  ] as const) {
    if (key.startsWith(prefix) && key.length > prefix.length) {
      return { type, id: key.slice(prefix.length) }
    }
  }
  return null
}
