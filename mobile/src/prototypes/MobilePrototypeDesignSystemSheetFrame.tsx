import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'

/** How far a sheet may grow: a share of the screen, so the screen behind it stays in view. */
const SHEET_MAX_HEIGHT_SHARE = 0.85

/** The frame of the design system sheets: a title (with an optional second line), Close, and a scrolling body. */
export function MobilePrototypeDesignSystemSheetFrame({
  title,
  mono = false,
  subtitle,
  onClose,
  children
}: {
  title: string
  /** The title is a token name: shown in the mono face. */
  mono?: boolean
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  const { height: screenHeight } = useWindowDimensions()
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={[styles.title, mono && styles.mono]}>
            {title}
          </Text>
          {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: screenHeight * SHEET_MAX_HEIGHT_SHARE }}
        contentContainerStyle={styles.body}
      >
        {children}
      </ScrollView>
    </View>
  )
}

/** A chip that is on or off: the variant chips, the token options and the add kinds. */
export function MobilePrototypeDesignSystemChip({
  label,
  on,
  mono = false,
  solid = false,
  onPress
}: {
  label: string
  on: boolean
  /** A token option: square-cornered, in the mono face. */
  mono?: boolean
  /** The chosen chip is filled, as the add kinds are; otherwise it is raised. */
  solid?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[
        styles.chip,
        mono ? styles.chipMono : styles.chipRound,
        on && (solid ? styles.chipSolid : styles.chipOn)
      ]}
    >
      <Text
        style={[
          styles.chipText,
          mono && styles.chipTextMono,
          on && (solid ? styles.chipTextSolid : styles.chipTextOn)
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export const designSystemSheetStyles = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: 13 },
  note: { color: colors.textSecondary, fontSize: typography.metaSize },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised,
    color: colors.textPrimary,
    fontSize: 15
  }
})

const styles = StyleSheet.create({
  sheet: { gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  mono: { fontFamily: typography.monoFamily },
  subtitle: { color: colors.textSecondary, fontSize: typography.metaSize },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textSecondary, fontSize: 18 },
  body: { gap: 12 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  chipRound: { borderRadius: 999 },
  chipMono: { borderRadius: 8, paddingHorizontal: 10 },
  chipOn: { backgroundColor: colors.bgRaised },
  chipSolid: { backgroundColor: colors.textPrimary },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextMono: { fontFamily: typography.monoFamily, fontSize: typography.metaSize },
  chipTextOn: { color: colors.textPrimary },
  chipTextSolid: { color: colors.bgBase }
})
