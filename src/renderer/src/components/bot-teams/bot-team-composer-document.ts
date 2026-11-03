import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamComposerItem } from '../../../../shared/bot-team-composer-menu'

/** The attributes of the chip a picked item leaves in the composer; null for a command, which runs instead. */
export type BotTeamComposerChipAttrs = {
  token: string
  kind: 'bot' | 'team' | 'file'
  agent: BotTeamBot['agent'] | null
  character: BotTeam['character'] | null
}

export function botTeamComposerChipAttrs(
  item: BotTeamComposerItem
): BotTeamComposerChipAttrs | null {
  switch (item.kind) {
    case 'bot':
      return { token: `@${item.bot.name}`, kind: 'bot', agent: item.bot.agent, character: null }
    case 'team':
      return {
        token: `@${item.team.name}`,
        kind: 'team',
        agent: null,
        character: item.team.character
      }
    case 'file':
      return { token: `@${item.path}`, kind: 'file', agent: null, character: null }
    case 'command':
      return null
  }
}
