import { Pressable, Text } from 'react-native'
import { Check } from 'lucide-react-native'
import { BottomDrawer } from '../components/BottomDrawer'
import { colors } from '../theme/mobile-theme'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The sheet that switches the Conference room to another team. */
export function MobileBotTeamRoomSwitcher({
  visible,
  teams,
  currentTeamId,
  workingOf,
  unreachable,
  onClose,
  onPick
}: {
  visible: boolean
  teams: readonly BotTeam[]
  currentTeamId: string
  workingOf: (teamId: string) => boolean
  unreachable: boolean
  onClose: () => void
  onPick: (teamId: string) => void
}) {
  return (
    <BottomDrawer visible={visible} onClose={onClose}>
      <Text style={styles.sheetTitle}>Conference rooms</Text>
      {teams.map((entry) => (
        <Pressable
          key={entry.id}
          accessibilityRole="button"
          onPress={() => {
            onClose()
            onPick(entry.id)
          }}
          style={styles.row}
        >
          <MobileBotTeamCharacterIcon
            character={entry.character}
            size={28}
            working={workingOf(entry.id)}
            unreachable={unreachable}
          />
          <Text style={[styles.rowTitle, styles.grow]}>{entry.name}</Text>
          {entry.id === currentTeamId ? <Check size={18} color={colors.textPrimary} /> : null}
        </Pressable>
      ))}
    </BottomDrawer>
  )
}
