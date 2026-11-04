import type { BotTeam, BotTeamBot } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamComposerItem } from '../../../../shared/bot-team-composer-menu'
import type { MarketplaceAppId } from '../../../../shared/marketplace-apps'
import type { RepoIcon } from '../../../../shared/repo-icon'

/** The attributes of the chip a picked item leaves in the composer; null for a command, which runs instead. */
export type BotTeamComposerChipAttrs = {
  token: string
  kind: 'bot' | 'team' | 'project' | 'file' | 'app'
  agent: BotTeamBot['agent'] | null
  character: BotTeam['character'] | null
  logo: RepoIcon | null
  appId: MarketplaceAppId | null
}

export function botTeamComposerChipAttrs(
  item: BotTeamComposerItem
): BotTeamComposerChipAttrs | null {
  const none = { agent: null, character: null, logo: null, appId: null }
  switch (item.kind) {
    case 'bot':
      return { ...none, token: `@${item.bot.name}`, kind: 'bot', agent: item.bot.agent }
    case 'team':
      return { ...none, token: `@${item.team.name}`, kind: 'team', character: item.team.character }
    case 'project':
      return { ...none, token: `@${item.project.name}`, kind: 'project', logo: item.project.logo }
    case 'file':
      return { ...none, token: `@${item.path}`, kind: 'file' }
    case 'app':
      return { ...none, token: `@${item.app.name}`, kind: 'app', appId: item.app.id }
    case 'command':
      return null
  }
}
