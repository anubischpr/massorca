import type { MarketplaceAppMention } from './marketplace-app-mentions'
import type { RepoIcon } from './repo-icon'
import type { BotTeam, BotTeamBot } from './rpc-contract/bot-team-params'

/** MassOrca's commands that assume no one session and no agent; the room has neither. */
export const BOT_TEAM_ROOM_COMMANDS = ['resume', 'session'] as const
export type BotTeamRoomCommand = (typeof BOT_TEAM_ROOM_COMMANDS)[number]

export type BotTeamMentionFile = { path: string }

export type BotTeamMentionTeam = Pick<BotTeam, 'id' | 'name' | 'character'>

/** A project the room can name; `logo` is its linked Workspaces project's image or emoji, null for none. */
export type BotTeamMentionProject = { id: string; name: string; logo: RepoIcon | null }

export type BotTeamComposerItem =
  | { kind: 'bot'; bot: Pick<BotTeamBot, 'id' | 'name' | 'job' | 'agent'>; insert: string }
  | { kind: 'team'; team: BotTeamMentionTeam; insert: string }
  | { kind: 'project'; project: BotTeamMentionProject; insert: string }
  | { kind: 'file'; path: string; insert: string }
  | { kind: 'app'; app: MarketplaceAppMention; insert: string }
  | { kind: 'command'; command: BotTeamRoomCommand; insert: string }

export type BotTeamComposerMenu = {
  items: BotTeamComposerItem[]
  /** The span the chosen item replaces. */
  start: number
  end: number
}

const MAX_ITEMS = 12
const OPEN_MENTION = /(?:^|\s)@(\S*)$/

/** True while an @ mention is being typed at the caret; files are listed only then. */
export function botTeamMentionOpen(text: string, caret: number): boolean {
  return OPEN_MENTION.test(text.slice(0, caret))
}

/** A Workspaces project icon that reads as a logo: an image or an emoji, never the generic glyph. */
export function botTeamProjectLogo(icon: RepoIcon | null | undefined): RepoIcon | null {
  return icon && icon.type !== 'lucide' ? icon : null
}

/** What the room's composer offers at the caret: bots, other teams, projects, files and apps after `@`, commands after a leading `/`. */
export function botTeamComposerMenu(args: {
  text: string
  caret: number
  bots: readonly Pick<BotTeamBot, 'id' | 'name' | 'job' | 'agent'>[]
  /** The other teams: `@Name` sends the request there, with no query. */
  teams?: readonly BotTeamMentionTeam[]
  projects?: readonly BotTeamMentionProject[]
  files?: readonly string[]
  /** Installed Marketplace apps, listed last. */
  apps?: readonly MarketplaceAppMention[]
  /** A surface that cannot run the room's commands offers none. */
  commands?: readonly BotTeamRoomCommand[]
}): BotTeamComposerMenu | null {
  const before = args.text.slice(0, args.caret)
  const command = args.commands ? before.match(/^\/(\S*)$/) : null
  if (command && args.commands) {
    const query = command[1].toLowerCase()
    const items = args.commands
      .filter((name) => name.startsWith(query))
      .map((name) => ({ kind: 'command' as const, command: name, insert: `/${name}` }))
    return items.length > 0 ? { items, start: 0, end: args.caret } : null
  }
  const mention = before.match(OPEN_MENTION)
  if (!mention) {
    return null
  }
  const query = mention[1].toLowerCase()
  const bots: BotTeamComposerItem[] = args.bots
    .filter((bot) => bot.name.toLowerCase().includes(query))
    .map((bot) => ({ kind: 'bot', bot, insert: `@${bot.name} ` }))
  const teams: BotTeamComposerItem[] = (args.teams ?? [])
    .filter((team) => team.name.toLowerCase().includes(query))
    .map((team) => ({ kind: 'team', team, insert: `@${team.name} ` }))
  const projects: BotTeamComposerItem[] = (args.projects ?? [])
    .filter((project) => project.name.toLowerCase().includes(query))
    .map((project) => ({ kind: 'project', project, insert: `@${project.name} ` }))
  const files: BotTeamComposerItem[] = (args.files ?? [])
    .filter((path) => path.toLowerCase().includes(query))
    .map((path) => ({ kind: 'file', path, insert: `@${path} ` }))
  const apps: BotTeamComposerItem[] = (args.apps ?? [])
    .filter((app) => app.name.toLowerCase().includes(query))
    .map((app) => ({ kind: 'app', app, insert: `@${app.name} ` }))
  // Why: apps keep their room at the end, and up to 3 files keep theirs before the long groups.
  const room = MAX_ITEMS - apps.length
  const groups = [...bots, ...teams, ...projects].slice(0, room - Math.min(files.length, 3))
  const items = [...groups, ...files.slice(0, room - groups.length), ...apps]
  return items.length > 0
    ? { items, start: args.caret - mention[1].length - 1, end: args.caret }
    : null
}

export function applyBotTeamComposerItem(
  text: string,
  menu: Pick<BotTeamComposerMenu, 'start' | 'end'>,
  item: Pick<BotTeamComposerItem, 'insert'>
): { text: string; caret: number } {
  return {
    text: text.slice(0, menu.start) + item.insert + text.slice(menu.end),
    caret: menu.start + item.insert.length
  }
}
