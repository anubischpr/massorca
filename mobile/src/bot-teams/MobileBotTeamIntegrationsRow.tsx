import { Pressable, Text } from 'react-native'
import { ChevronRight, Plug } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The Bot teams home's row to the apps a team could be given. */
export function MobileBotTeamIntegrationsRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Integrations"
      onPress={onPress}
      style={[styles.row, { margin: spacing.lg }]}
    >
      <Plug size={18} color={colors.textSecondary} />
      <Text style={[styles.rowTitle, styles.grow]}>Integrations</Text>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  )
}
