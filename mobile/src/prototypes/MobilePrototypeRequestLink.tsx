import { Pressable, StyleSheet, Text } from 'react-native'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { colors, spacing } from '../theme/mobile-theme'
import { prototypeRequestLinkLabel } from './mobile-prototype-request-links'

/** Under the message that asked for prototypes: the set it opened, and a way into Prototypes. */
export function MobilePrototypeRequestLink({
  set,
  onOpen
}: {
  set: PrototypeListedSet
  onOpen: (set: PrototypeListedSet) => void
}) {
  const label = prototypeRequestLinkLabel(set)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, Open`}
      onPress={() => onOpen(set)}
      style={styles.card}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.open}>Open ›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  label: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  open: { color: colors.textSecondary, fontSize: 15 }
})
