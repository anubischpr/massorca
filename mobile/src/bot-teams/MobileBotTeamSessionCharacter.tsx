import { StyleSheet, View } from 'react-native'
import type { BotTeamSessionTeamsResult } from '../../../src/shared/rpc-contract/bot-team-session-team-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'

type SessionTeam = BotTeamSessionTeamsResult['sessionTeams'][string]

/** The team's character, small, right after a session's name; a session no team started shows none. */
export function MobileBotTeamSessionCharacter({
  sessionTeam
}: {
  sessionTeam: SessionTeam | undefined
}) {
  if (!sessionTeam) {
    return null
  }
  return (
    <View accessible accessibilityLabel={sessionTeam.teamName} style={styles.mark}>
      <MobileBotTeamCharacterIcon character={sessionTeam.character} size={12} still />
    </View>
  )
}

const styles = StyleSheet.create({
  mark: {
    flexShrink: 0
  }
})
