import {
  botTeamProjectLogo,
  type BotTeamMentionProject
} from '../../../src/shared/bot-team-composer-menu'
import type { BotTeamMentionName } from '../../../src/shared/bot-team-mention-text'
import type { RepoIcon } from '../../../src/shared/repo-icon'
import type { BotTeam, BotTeamCharacter } from '../../../src/shared/rpc-contract/bot-team-params'
import type {
  BotTeamLinkableWorkspace,
  BotTeamProject
} from '../../../src/shared/rpc-contract/bot-team-room-params'

/** A bot, team or project the room can draw as a chip, with what its icon needs. */
export type MobileBotTeamMentionTarget = BotTeamMentionName & {
  /** The bot's agent; null for a team or a project. */
  agent: string | null
  /** The team's character; null for a bot or a project. */
  character: BotTeamCharacter | null
  /** The project's logo; absent for a bot or team, null for a project without an image or emoji. */
  logo?: RepoIcon | null
}

/** The room team's bots, the other teams and the projects, the names a room message may mention. */
export function botTeamMentionTargets(
  team: BotTeam,
  teams: readonly BotTeam[],
  projects: readonly BotTeamMentionProject[] = []
): MobileBotTeamMentionTarget[] {
  return [
    ...team.bots.map((bot): MobileBotTeamMentionTarget => ({
      name: bot.name,
      kind: 'bot',
      agent: bot.agent,
      character: null
    })),
    ...teams
      .filter((entry) => entry.id !== team.id)
      .map((entry): MobileBotTeamMentionTarget => ({
        name: entry.name,
        kind: 'team',
        agent: null,
        character: entry.character
      })),
    ...projects.map((project): MobileBotTeamMentionTarget => ({
      name: project.name,
      kind: 'project',
      agent: null,
      character: null,
      logo: project.logo
    }))
  ]
}

/**
 * The team's active projects as the room can name them, each with the logo of its linked
 * Workspaces project. The host lists those workspaces with their icons; a project with no
 * linked workspace, or one with a lucide icon, gets no logo.
 */
export function botTeamMentionProjects(
  projects: readonly BotTeamProject[],
  workspaces: readonly BotTeamLinkableWorkspace[]
): BotTeamMentionProject[] {
  return projects
    .filter((project) => project.archivedAt == null)
    .map((project) => {
      const key = project.workspace?.key
      const icon =
        key === undefined ? undefined : workspaces.find((entry) => entry.key === key)?.icon
      return { id: project.id, name: project.name, logo: botTeamProjectLogo(icon) }
    })
}
