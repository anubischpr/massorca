import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

/**
 * The chip a sent `<orca-checklist-update>` block shows in the person's own message. It opens to
 * the block's text, the same words the agent reads.
 */
export function MobileNativeChatChecklistChip({ update }: { update: string }) {
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Checklist changes"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        onPress={() => setExpanded((open) => !open)}
      >
        <ListChecks size={14} color={colors.textSecondary} strokeWidth={2.1} />
        <Text style={styles.label}>Checklist changes</Text>
        <Chevron size={12} color={colors.textMuted} strokeWidth={2.1} />
      </Pressable>
      {expanded ? (
        <Text selectable style={styles.body}>
          {update}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs
  },
  chip: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  pressed: {
    backgroundColor: colors.bgPanel
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '600'
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily
  }
})
