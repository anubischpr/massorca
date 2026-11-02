import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import { botTeamStyles as styles } from './mobile-bot-team-styles'

/** The top bar of a Bot teams screen: back, an optional mark, and the title. */
export function MobileBotTeamWorkBar({
  title,
  icon = null,
  onBack
}: {
  title: string
  icon?: ReactNode
  onBack: () => void
}) {
  return (
    <View style={[styles.bar, { gap: spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.iconButton}
      >
        <ChevronLeft size={22} color={colors.textSecondary} />
      </Pressable>
      {icon}
      <Text accessibilityRole="header" style={styles.barTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  )
}
