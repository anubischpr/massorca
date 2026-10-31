import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { colors, spacing } from '../theme/mobile-theme'

const PART_ROWS = [0, 1, 2, 3] as const

function Block({ style }: { style: StyleProp<ViewStyle> }) {
  return <View style={[styles.block, style]} />
}

/**
 * The merge sheet's shape while the agent's plan is generated: the title, the part rows, and the page.
 * Only the shape shows; the sheet is replaced by the review once the plan arrives.
 */
export function MobilePrototypeMergeSkeleton() {
  return (
    <View
      testID="mobile-merge-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.sheet}
    >
      <View style={styles.header}>
        <Block style={styles.title} />
        <Block style={styles.subtitle} />
      </View>
      <View style={styles.rows}>
        {PART_ROWS.map((row) => (
          <Block key={row} style={styles.row} />
        ))}
      </View>
      <Block style={styles.page} />
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.md },
  header: { gap: spacing.xs },
  block: { backgroundColor: colors.bgPanel, borderRadius: 6 },
  title: { height: 18, width: '50%' },
  subtitle: { height: 12, width: '80%' },
  rows: { gap: 6 },
  row: { height: 40, borderRadius: 12 },
  page: { height: 360, borderRadius: 10 }
})
