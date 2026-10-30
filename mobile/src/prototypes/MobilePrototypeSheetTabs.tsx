import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme/mobile-theme'

export type MobilePrototypeSheetTab = {
  key: string
  label: string
  selected: boolean
  onPress: () => void
}

/** The two-tab switch at the top of a Prototypes bottom sheet. */
export function MobilePrototypeSheetTabs({ tabs }: { tabs: readonly MobilePrototypeSheetTab[] }) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab.selected }}
          onPress={tab.onPress}
          style={[styles.tab, tab.selected && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab.selected && styles.tabTextOn]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 3, borderRadius: 10, backgroundColor: colors.bgBase },
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  tabOn: { backgroundColor: colors.bgRaised },
  tabText: { color: colors.textSecondary, fontSize: 14 },
  tabTextOn: { color: colors.textPrimary }
})
