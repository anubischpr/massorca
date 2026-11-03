import { useMemo } from 'react'
import { useAppStore } from '@/store'
import {
  botTeamProjectLogo,
  type BotTeamMentionProject
} from '../../../../shared/bot-team-composer-menu'
import { botTeamRepoProjectKey } from '../../../../shared/bot-team-project-workspace-key'
import type { Repo } from '../../../../shared/repo-types'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamMentionIcon } from './BotTeamMentionChip'

/** The icon of the Workspaces repo a project is linked to; null for a team folder or a repo without one. */
export function linkedRepoIcon(repos: readonly Repo[], project: BotTeamProject): Repo['repoIcon'] {
  const key = project.workspace?.key
  return repos.find((repo) => botTeamRepoProjectKey(repo.id) === key)?.repoIcon ?? null
}

/** The projects @ can name, archived ones left out, each with its linked project's logo. */
export function useBotTeamMentionProjects(
  projects: readonly BotTeamProject[]
): BotTeamMentionProject[] {
  const repos = useAppStore((state) => state.repos)
  return useMemo(
    () =>
      projects
        .filter((project) => project.archivedAt == null)
        .map((project) => ({
          id: project.id,
          name: project.name,
          logo: botTeamProjectLogo(linkedRepoIcon(repos, project))
        })),
    [projects, repos]
  )
}

/** The room's mentionable projects, and every name a message can chip: bots, other teams, then projects. */
export function useBotTeamRoomMentions(
  team: BotTeam,
  otherTeams: readonly BotTeam[],
  projects: readonly BotTeamProject[]
): { mentionProjects: BotTeamMentionProject[]; mentionIcons: BotTeamMentionIcon[] } {
  const mentionProjects = useBotTeamMentionProjects(projects)
  const mentionIcons = useMemo<BotTeamMentionIcon[]>(
    () => [
      ...team.bots.map((bot) => ({ name: bot.name, kind: 'bot' as const, agent: bot.agent })),
      ...otherTeams.map((entry) => ({
        name: entry.name,
        kind: 'team' as const,
        character: entry.character
      })),
      ...mentionProjects.map((entry) => ({
        name: entry.name,
        kind: 'project' as const,
        logo: entry.logo
      }))
    ],
    [team.bots, otherTeams, mentionProjects]
  )
  return { mentionProjects, mentionIcons }
}
