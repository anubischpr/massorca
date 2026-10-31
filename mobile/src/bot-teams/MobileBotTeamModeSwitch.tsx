import { Pressable, View } from 'react-native'
import { Layers, Users } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

export type MobileHostMode = 'teams' | 'workspaces'

/** The small top bar switch between a host's teams and its workspaces. */
export function MobileBotTeamModeSwitch({
  mode,
  onChange
}: {
  mode: MobileHostMode
  onChange: () => void
}) {
  return (
    <View style={styles.modeSwitch}>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Bot teams"
        accessibilityState={{ selected: mode === 'teams' }}
        onPress={mode === 'teams' ? undefined : onChange}
        style={[styles.modeOption, mode === 'teams' && styles.modeOptionOn]}
      >
        <Users size={18} color={colors.textPrimary} />
      </Pressable>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Workspaces"
        accessibilityState={{ selected: mode === 'workspaces' }}
        onPress={mode === 'workspaces' ? undefined : onChange}
        style={[styles.modeOption, mode === 'workspaces' && styles.modeOptionOn]}
      >
        <Layers size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  )
}
