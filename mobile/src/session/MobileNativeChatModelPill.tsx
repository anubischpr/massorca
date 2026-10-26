import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native'
import { ChevronDown, Zap } from 'lucide-react-native'
import { MobileAgentIcon } from '../components/MobileAgentIcon'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { isModelPillIconOnly } from './mobile-native-chat-model-pill-width'

/** Model selector: agent icon, model name and chevron. It is the only action-row item that shrinks. */
export function MobileNativeChatModelPill({
  agent,
  label,
  fast,
  accessibleName,
  disabled,
  onPress
}: {
  agent: string | null
  label: string
  fast: boolean
  accessibleName: string
  disabled: boolean
  onPress: () => void
}): React.JSX.Element {
  const { width } = useWindowDimensions()
  const iconOnly = isModelPillIconOnly(width, agent !== null)
  return (
    <Pressable
      accessibilityLabel={accessibleName}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.pill, pressed && !disabled && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
    >
      {agent ? <MobileAgentIcon agentId={agent} size={16} /> : null}
      {iconOnly ? null : (
        <Text
          style={[styles.label, disabled && styles.labelDisabled]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      )}
      {fast ? (
        <Zap size={12} color={colors.statusAmber} fill={colors.statusAmber} strokeWidth={2} />
      ) : null}
      <ChevronDown size={12} color={disabled ? colors.textMuted : colors.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexShrink: 1,
    maxWidth: 180,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  label: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontWeight: '600'
  },
  labelDisabled: {
    color: colors.textMuted
  },
  pressed: {
    opacity: 0.7
  }
})
