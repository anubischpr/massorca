import { Text, View } from 'react-native'
import { BOT_TEAM_ALL_AUTHOR } from '../../../src/shared/bot-team-greeting'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotAgentIcon } from './MobileBotAgentIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** Who wrote a message: one bot, or every bot's icon under "All" for the team's greeting. */
export function RoomWho({
  bots,
  authorBotId,
  from
}: {
  bots: BotTeam['bots']
  authorBotId: string | null
  /** The other team a returned message came from. */
  from?: BotTeam
}) {
  if (authorBotId === BOT_TEAM_ALL_AUTHOR) {
    return (
      <View style={styles.roomWho}>
        {bots.map((bot) => (
          <MobileBotAgentIcon key={bot.id} agentId={bot.agent} size={14} />
        ))}
        <Text style={styles.roomWhoText}>All</Text>
      </View>
    )
  }
  const author = bots.find((bot) => bot.id === authorBotId)
  return author ? (
    <View style={styles.roomWho}>
      <MobileBotAgentIcon agentId={author.agent} size={14} />
      <Text style={styles.roomWhoText}>{author.name}</Text>
      {from ? <Text style={styles.rowMeta}>{`From ${from.name}`}</Text> : null}
    </View>
  ) : null
}
