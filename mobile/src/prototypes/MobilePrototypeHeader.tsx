import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'

/** The Prototypes screens' navigation bar: Back, the title (with an optional second line), and a trailing control. */
export function MobilePrototypeHeader({
  title,
  subtitle,
  backLabel = 'Back',
  onBack,
  trailing
}: {
  title: string
  subtitle?: string
  backLabel?: string
  onBack: () => void
  trailing?: ReactNode
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={styles.back}
      >
        <ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.2} />
      </Pressable>
      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleBlock: {
    flex: 1,
    minWidth: 0
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '600'
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  }
})
