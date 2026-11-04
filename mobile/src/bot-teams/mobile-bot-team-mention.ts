import {
  botTeamProjectLogo,
  type BotTeamMentionProject
} from '../../../src/shared/bot-team-composer-menu'
import {
  splitBotTeamMentionText,
  type BotTeamMentionName,
  type BotTeamMentionSegment
} from '../../../src/shared/bot-team-mention-text'
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

/** A pill the draft shows: a known mention or a file path, with the span of text it stands for. */
export type MobileBotTeamDraftMention =
  | { kind: 'mention'; target: MobileBotTeamMentionTarget; start: number; end: number }
  | { kind: 'file'; path: string; start: number; end: number }

/**
 * The mentions a draft names, each with the span its pill stands for. A mention at the very end of
 * the draft is still being typed, so its pill waits until the text goes on past it.
 */
export function botTeamDraftMentions(
  text: string,
  targets: readonly MobileBotTeamMentionTarget[]
): MobileBotTeamDraftMention[] {
  const mentions: MobileBotTeamDraftMention[] = []
  let start = 0
  for (const segment of splitBotTeamMentionText(text, targets, { files: true })) {
    const end = start + segment.value.length
    const mention = end < text.length ? draftMentionOf(segment, targets, start, end) : null
    if (mention) {
      mentions.push(mention)
    }
    start = end
  }
  return mentions
}

function draftMentionOf(
  segment: BotTeamMentionSegment,
  targets: readonly MobileBotTeamMentionTarget[],
  start: number,
  end: number
): MobileBotTeamDraftMention | null {
  if (segment.kind === 'file') {
    return { kind: 'file', path: segment.path, start, end }
  }
  if (segment.kind !== 'mention') {
    return null
  }
  const { name } = segment
  const target = targets.find((entry) => entry.name === name)
  return target ? { kind: 'mention', target, start, end } : null
}

/** The draft without one of its pills: the mention and the space after it, or else the space before it. */
export function removeBotTeamDraftMention(
  text: string,
  mention: Pick<MobileBotTeamDraftMention, 'start' | 'end'>
): string {
  const after = text[mention.end] === ' ' ? mention.end + 1 : mention.end
  const before =
    after === mention.end && text[mention.start - 1] === ' ' ? mention.start - 1 : mention.start
  return text.slice(0, before) + text.slice(after)
}
