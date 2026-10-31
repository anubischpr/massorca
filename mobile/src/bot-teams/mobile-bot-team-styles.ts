import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

export const botTeamStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs
  },
  barTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  grow: { flex: 1 },
  hidden: { display: 'none' },
  modeSwitch: {
    flexDirection: 'row',
    height: 34,
    padding: 2,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  modeOption: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15
  },
  modeOptionOn: { backgroundColor: colors.bgRaised },
  carousel: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  carouselItem: { width: 84, alignItems: 'center', gap: spacing.sm },
  carouselName: { color: colors.textPrimary, fontSize: typography.metaSize },
  form: { gap: spacing.sm, padding: spacing.lg },
  label: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    marginTop: spacing.sm
  },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel,
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  inputTall: {
    minHeight: 88,
    paddingTop: spacing.md,
    textAlignVertical: 'top'
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  rowSelected: { borderColor: colors.textSecondary },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    marginTop: 2
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.bodySize,
    padding: spacing.lg
  },
  primary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceBright
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: {
    color: colors.bgBase,
    fontSize: typography.bodySize,
    fontWeight: '600'
  }
})
