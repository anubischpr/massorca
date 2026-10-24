import { StyleSheet, Text, View } from 'react-native'
import type { AccountsSnapshot } from '../components/AccountUsage'
import { getHostUsageMeters } from '../components/host-usage-meters'
import { MobileHostUsageMeterRows } from '../components/MobileHostUsageMeterRows'
import { spacing } from '../theme/mobile-theme'
import { styles } from './mobile-accounts-screen-styles'

/** Host-polled meters below the account sections; hidden when the host reports none. */
export function MobileAccountsHostUsageSection(props: { snapshot: AccountsSnapshot; now: number }) {
  if (getHostUsageMeters(props.snapshot).length === 0) {
    return null
  }
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeading}>Other usage</Text>
      </View>
      <View style={[styles.card, sectionStyles.meters]}>
        <MobileHostUsageMeterRows snapshot={props.snapshot} now={props.now} />
      </View>
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  meters: { paddingVertical: spacing.md, paddingHorizontal: spacing.md + 2, gap: spacing.md }
})
