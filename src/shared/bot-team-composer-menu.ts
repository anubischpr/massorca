import type { BotTeamBot } from './rpc-contract/bot-team-params'

/** MassOrca's commands that assume no one session and no agent; the room has neither. */
export const BOT_TEAM_ROOM_COMMANDS = ['resume', 'session'] as const
export type BotTeamRoomCommand = (typeof BOT_TEAM_ROOM_COMMANDS)[number]

export type BotTeamMentionFile = { path: string }

export type BotTeamComposerItem =
  | { kind: 'bot'; bot: Pick<BotTeamBot, 'id' | 'name' | 'job' | 'agent'>; insert: string }
  | { kind: 'file'; path: string; insert: string }
  | { kind: 'command'; command: BotTeamRoomCommand; insert: string }

export type BotTeamComposerMenu = {
  items: BotTeamComposerItem[]
  /** The span the chosen item replaces. */
  start: number
  end: number
}

const MAX_ITEMS = 12

/** What the room's composer offers at the caret: bots and files after `@`, commands after a leading `/`. */
export function botTeamComposerMenu(args: {
  text: string
  caret: number
  bots: readonly Pick<BotTeamBot, 'id' | 'name' | 'job' | 'agent'>[]
  files?: readonly string[]
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
  const mention = before.match(/(?:^|\s)@(\S*)$/)
  if (!mention) {
    return null
  }
  const query = mention[1].toLowerCase()
  const bots: BotTeamComposerItem[] = args.bots
    .filter((bot) => bot.name.toLowerCase().includes(query))
    .map((bot) => ({ kind: 'bot', bot, insert: `@${bot.name} ` }))
  const files: BotTeamComposerItem[] = (args.files ?? [])
    .filter((path) => path.toLowerCase().includes(query))
    .map((path) => ({ kind: 'file', path, insert: `@${path} ` }))
  const items = [...bots, ...files].slice(0, MAX_ITEMS)
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
