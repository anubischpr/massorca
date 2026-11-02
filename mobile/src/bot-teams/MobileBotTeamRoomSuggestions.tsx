import { FileText } from 'lucide-react-native'
import { botTeamComposerMenu } from '../../../src/shared/bot-team-composer-menu'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { ComposerSuggestion } from '../session/MobileNativeChatComposerSuggestions'
import { colors } from '../theme/mobile-theme'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'

/** What the room's composer offers at the caret: bots, then other teams, then files, after an @. */
export function botTeamRoomSuggestions({
  text,
  caret,
  team,
  otherTeams,
  files
}: {
  text: string
  caret: number
  team: BotTeam
  otherTeams: readonly BotTeam[]
  files: readonly string[]
}): ComposerSuggestion[] | null {
  const menu = botTeamComposerMenu({ text, caret, bots: team.bots, teams: otherTeams, files })
  return (
    menu?.items.flatMap((item): ComposerSuggestion[] => {
      if (item.kind === 'bot') {
        return [
          {
            kind: 'custom',
            key: item.bot.id,
            insert: item.insert,
            label: item.bot.name,
            ...(item.bot.job ? { detail: item.bot.job } : {}),
            icon: <MobileBotAgentIcon agentId={item.bot.agent} size={16} />
          }
        ]
      }
      if (item.kind === 'team') {
        return [
          {
            kind: 'custom',
            key: `team:${item.team.id}`,
            insert: item.insert,
            label: item.team.name,
            icon: <MobileBotTeamCharacterIcon character={item.team.character} size={16} still />
          }
        ]
      }
      if (item.kind === 'file') {
        return [
          {
            kind: 'custom',
            key: `file:${item.path}`,
            insert: item.insert,
            label: item.path,
            icon: <FileText size={16} color={colors.textSecondary} />
          }
        ]
      }
      return []
    }) ?? null
  )
}
