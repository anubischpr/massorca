import { Pressable, StyleSheet, Text } from 'react-native'
import { colors } from '../theme/mobile-theme'
import { mergeButtonLabel } from './mobile-prototype-directions-model'
import { MobilePrototypeStarIcon } from './MobilePrototypeStarIcon'

/** "Merge (n)" in the set header: disabled until two directions are starred. */
export function MobilePrototypeMergeButton({
  starCount,
  enabled,
  onPress
}: {
  starCount: number
  enabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={[styles.button, !enabled && styles.buttonOff]}
    >
      <MobilePrototypeStarIcon size={16} filled color={colors.statusAmber} strokeWidth={1.6} />
      <Text style={[styles.text, !enabled && styles.textOff]}>{mergeButtonLabel(starCount)}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.statusAmberBorder
  },
  buttonOff: { borderColor: colors.borderSubtle },
  text: { color: colors.textPrimary, fontSize: 14 },
  textOff: { color: colors.textMuted }
})
