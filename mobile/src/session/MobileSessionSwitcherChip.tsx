import { Pressable, StyleSheet, Text } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { AgentStateDot } from '../components/AgentStateDot'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { MobileSessionTab } from './mobile-session-route-types'
import {
  mobileSessionSwitcherDot,
  type MobileSessionSwitcherRow
} from './mobile-session-switcher-rows'
import { getMobileSessionTabTitle } from './mobile-terminal-tab-agent'

/** The active tab's status, title, and the tab count; tapping it opens the Sessions sheet. */
export function MobileSessionSwitcherChip({
  activeRow,
  tabCount,
  onPress
}: {
  activeRow: MobileSessionSwitcherRow<MobileSessionTab> | null
  tabCount: number
  onPress: () => void
}) {
  const title = activeRow ? getMobileSessionTabTitle(activeRow.tab) : 'Sessions'
  const dot = activeRow?.status ? mobileSessionSwitcherDot(activeRow.status) : null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sessions, ${title}, ${tabCount} ${tabCount === 1 ? 'tab' : 'tabs'}`}
      hitSlop={spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {dot ? <AgentStateDot state={dot} /> : null}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <ChevronDown size={14} color={colors.textMuted} strokeWidth={2} />
      <Text style={styles.count}>{tabCount}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  pressed: {
    backgroundColor: colors.bgRaised
  },
  title: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '500'
  },
  count: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily
  }
})
