import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { PrototypeListedDirection } from '../../../src/shared/rpc-contract/prototype-params'
import { colors, spacing } from '../theme/mobile-theme'
import { directionTag, mainFirst } from './mobile-prototype-directions-model'

/** The set's directions under the header: the main first, the read-only ones nested to its right. */
export function MobilePrototypeDirectionStrip({
  directions,
  state,
  focusLetter,
  onFocus
}: {
  directions: readonly PrototypeListedDirection[]
  state: PrototypeSetState
  /** The direction whose card is on screen. */
  focusLetter: string | null
  onFocus: (letter: string) => void
}) {
  const [main, ...others] = mainFirst(directions, state.active)
  const item = (direction: PrototypeListedDirection, isMain: boolean) => (
    <Pressable
      key={direction.letter}
      accessibilityRole="button"
      accessibilityState={{ selected: direction.letter === focusLetter }}
      onPress={() => onFocus(direction.letter)}
      style={[
        styles.item,
        isMain ? styles.itemMain : styles.itemChild,
        direction.letter === focusLetter && styles.itemOn
      ]}
    >
      <Text style={styles.letter}>{direction.letter}</Text>
      <Text style={styles.tag}>{directionTag(state, direction.letter)}</Text>
    </Pressable>
  )
  return (
    <ScrollView
      horizontal
      accessibilityLabel="Directions in this set"
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.strip}
    >
      {main === undefined ? null : item(main, state.active === main.letter)}
      <View accessibilityLabel="Read-only directions" style={styles.children}>
        {others.map((direction) => item(direction, false))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0 },
  strip: {
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs
  },
  children: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderSubtle
  },
  item: {
    minHeight: 44,
    justifyContent: 'center',
    gap: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1
  },
  itemMain: { borderColor: colors.borderSubtle },
  itemChild: { borderColor: colors.bgRaised },
  itemOn: { backgroundColor: colors.bgRaised },
  letter: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  tag: { color: colors.textSecondary, fontSize: 12 }
})
