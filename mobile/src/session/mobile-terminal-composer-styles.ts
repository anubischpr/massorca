import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

const KEY_HEIGHT = 34
const ROUND_BUTTON = 36

export const terminalComposerStyles = StyleSheet.create({
  dock: {
    zIndex: 20,
    gap: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.bgBase
  },
  keysToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm - 2,
    height: 28,
    marginLeft: spacing.md,
    paddingHorizontal: spacing.xs
  },
  keysToggleText: {
    color: colors.textSecondary,
    fontSize: typography.bodySize - 1
  },
  chordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
    marginHorizontal: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  chordBarBuilding: {
    borderColor: colors.accentBlue
  },
  chordParts: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs
  },
  chordPart: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  chordPartText: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize + 1
  },
  chordHint: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize + 1
  },
  chordSent: {
    flex: 1,
    color: colors.statusGreen,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize + 1
  },
  chordIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chordSend: {
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: colors.accentBlue
  },
  chordSendText: {
    color: colors.onAccent,
    fontSize: typography.metaSize + 1,
    fontWeight: '600'
  },
  keyRow: {
    flexGrow: 0
  },
  keyRowContent: {
    alignItems: 'center',
    gap: spacing.sm - 2,
    paddingHorizontal: spacing.md
  },
  key: {
    position: 'relative',
    flexShrink: 0,
    minWidth: 40,
    height: KEY_HEIGHT,
    paddingHorizontal: spacing.md - 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  keyModifier: {
    backgroundColor: colors.bgPanel
  },
  keyOn: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.textPrimary
  },
  keyText: {
    color: colors.textPrimary,
    fontFamily: typography.monoFamily,
    fontSize: typography.bodySize - 1
  },
  keyTextOn: {
    color: colors.bgBase
  },
  keyBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgBase,
    backgroundColor: colors.accentBlue
  },
  keyBadgeText: {
    color: colors.onAccent,
    fontSize: 10,
    fontWeight: '600'
  },
  addKey: {
    flexShrink: 0,
    width: KEY_HEIGHT,
    height: KEY_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardWrap: {
    marginHorizontal: spacing.md,
    position: 'relative'
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 48,
    paddingLeft: spacing.xs + 2,
    paddingRight: spacing.xs + 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  cardActive: {
    borderColor: colors.accentBlue
  },
  roundButton: {
    flexShrink: 0,
    width: ROUND_BUTTON,
    height: ROUND_BUTTON,
    borderRadius: ROUND_BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  roundButtonActive: {
    backgroundColor: colors.statusRed
  },
  widthButton: {
    flexShrink: 0,
    height: ROUND_BUTTON,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.bgRaised
  },
  widthButtonText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize + 1
  },
  tapArea: {
    flex: 1,
    minHeight: ROUND_BUTTON,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs
  },
  tapAreaText: {
    color: colors.textMuted,
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize + 1
  },
  enterButton: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary
  },
  menu: {
    position: 'absolute',
    left: 0,
    bottom: '100%',
    marginBottom: spacing.sm,
    width: 200,
    zIndex: 30,
    elevation: 8,
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgRaised
  },
  menuItem: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  menuItemText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  liveInputCapture: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    color: colors.textPrimary
  },
  disabled: {
    opacity: 0.35
  },
  pressed: {
    opacity: 0.8
  }
})
