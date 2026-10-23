import { StyleSheet, Text, View } from 'react-native'
import { colors, spacing } from '../theme/mobile-theme'
import {
  getUsageBarState,
  getWindowResetLabel,
  UsageBar,
  type AccountsSnapshot
} from './AccountUsage'
import { getHostUsageMeters } from './host-usage-meters'
import { MobileAgentIcon } from './MobileAgentIcon'

/** Host-polled usage meters (Antigravity, NaN) laid out like the Claude and Codex rows. */
export function MobileHostUsageMeterRows(props: {
  snapshot: AccountsSnapshot
  /** Reset countdowns are shown when the caller passes a clock. */
  now?: number
}) {
  const meters = getHostUsageMeters(props.snapshot)
  return (
    <>
      {meters.map((meter) => (
        <View key={meter.key} style={styles.row}>
          <View style={styles.icon}>
            <MobileAgentIcon agentId={meter.iconAgentId} size={18} />
          </View>
          <View style={styles.info}>
            <Text style={styles.label} numberOfLines={1}>
              {meter.label}
            </Text>
            <View style={styles.bars}>
              {meter.windows.map((window) => {
                const bar = getUsageBarState(meter.limits, window.key)
                return (
                  <UsageBar
                    key={window.key}
                    label={window.label}
                    usedPercent={bar.usedPercent}
                    unavailable={bar.unavailable}
                    loading={bar.loading}
                    resetText={
                      props.now === undefined
                        ? null
                        : getWindowResetLabel(meter.limits, window.key, props.now)
                    }
                  />
                )
              })}
            </View>
          </View>
        </View>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.bgRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  info: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  bars: { flexDirection: 'row', gap: spacing.md, marginTop: 4 }
})
