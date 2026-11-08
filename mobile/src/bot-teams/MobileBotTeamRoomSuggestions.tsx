import {
  botTeamComposerMenu,
  type BotTeamMentionProject
} from '../../../src/shared/bot-team-composer-menu'
import { Plug } from 'lucide-react-native'
import type { MarketplaceAppMention } from '../../../src/shared/marketplace-app-mentions'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { ComposerSuggestion } from '../session/MobileNativeChatComposerSuggestions'
import { MobileFileTypeIcon } from '../components/MobileFileTypeIcon'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { colors } from '../theme/mobile-theme'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'

// The desktop menu's headings.
const GROUP_HEADINGS = {
  bot: 'Bots',
  team: 'Teams',
  project: 'Projects',
  file: 'Files',
  app: 'Apps'
} as const

/**
 * What the room's composer offers at the caret: bots, other teams, projects, files, then connected apps, after an @.
 * Inserts stop at the name: the composer adds the space after a pick, so a trailing one doubles it.
 */
export function botTeamRoomSuggestions({
  text,
  caret,
  team,
  otherTeams,
  projects = [],
  files,
  apps = []
}: {
  text: string
  caret: number
  team: BotTeam
  otherTeams: readonly BotTeam[]
  projects?: readonly BotTeamMentionProject[]
  files: readonly string[]
  apps?: readonly MarketplaceAppMention[]
}): ComposerSuggestion[] | null {
  const menu = botTeamComposerMenu({
    text,
    caret,
    bots: team.bots,
    teams: otherTeams,
    projects,
    files,
    apps
  })
  if (!menu) {
    return null
  }
  // As on the desktop, kinds get headings only when the list mixes them.
  const mixed = new Set(menu.items.map((item) => item.kind)).size > 1
  const group = (kind: keyof typeof GROUP_HEADINGS): { group?: string } =>
    mixed ? { group: GROUP_HEADINGS[kind] } : {}
  return menu.items.flatMap((item): ComposerSuggestion[] => {
    if (item.kind === 'bot') {
      return [
        {
          ...group('bot'),
          kind: 'custom',
          key: item.bot.id,
          insert: item.insert.trimEnd(),
          label: item.bot.name,
          ...(item.bot.job ? { detail: item.bot.job } : {}),
          icon: <MobileBotAgentIcon agentId={item.bot.agent} size={16} />
        }
      ]
    }
    if (item.kind === 'team') {
      return [
        {
          ...group('team'),
          kind: 'custom',
          key: `team:${item.team.id}`,
          insert: item.insert.trimEnd(),
          label: item.team.name,
          icon: <MobileBotTeamCharacterIcon character={item.team.character} size={16} still />
        }
      ]
    }
    if (item.kind === 'project') {
      // A project without a logo shows its name alone.
      return [
        {
          ...group('project'),
          kind: 'custom',
          key: `project:${item.project.id}`,
          insert: item.insert.trimEnd(),
          label: item.project.name,
          ...(item.project.logo
            ? { icon: <MobileRepoIcon repoIcon={item.project.logo} size={16} /> }
            : {})
        }
      ]
    }
    if (item.kind === 'file') {
      return [
        {
          ...group('file'),
          kind: 'custom',
          key: `file:${item.path}`,
          insert: item.insert.trimEnd(),
          label: item.path,
          icon: <MobileFileTypeIcon path={item.path} size={16} />
        }
      ]
    }
    if (item.kind === 'app') {
      // The host adds the app's prompt lines from the inserted @Name, as on the desktop.
      return [
        {
          ...group('app'),
          kind: 'custom',
          key: `app:${item.app.id}`,
          insert: item.insert.trimEnd(),
          label: item.app.name,
          icon: <Plug size={16} color={colors.textSecondary} />
        }
      ]
    }
    return []
  })
}
