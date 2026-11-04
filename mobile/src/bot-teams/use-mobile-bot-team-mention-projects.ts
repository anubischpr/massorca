import { useMemo } from 'react'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'
import { useMobileLinkableWorkspaces } from './MobileBotTeamProjectWorkspace'
import { botTeamMentionProjects } from './mobile-bot-team-mention'

/** The team's active projects as @ can name them, each with its linked Workspaces project's logo. */
export function useBotTeamMentionProjects(
  client: RpcClient,
  team: BotTeam,
  projects: readonly BotTeamProject[],
  offline: boolean
) {
  // Why: the host lists its Workspaces projects with their icons; a team with Workspaces off has none.
  const linkable = useMobileLinkableWorkspaces(client, team.id, !offline && team.workspacesEnabled)
  return useMemo(
    () => botTeamMentionProjects(projects, Array.isArray(linkable) ? linkable : []),
    [projects, linkable]
  )
}
