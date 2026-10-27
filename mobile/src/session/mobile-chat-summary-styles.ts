import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

const TILE_WIDTH = '48%'

/** The Summary body's styles, kept apart from its components so each file stays readable. */
export const summaryStyles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl
  },
  emptyPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '600',
    textAlign: 'center'
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    textAlign: 'center'
  },
  emptyLine: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    paddingHorizontal: spacing.xs
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  agentText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  agentTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  dotWorking: {
    backgroundColor: colors.statusGreen
  },
  dotIdle: {
    backgroundColor: colors.textMuted
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  modelText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  tile: {
    width: TILE_WIDTH,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  tileIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised
  },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  tileValue: {
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  strip: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  thumb: {
    width: 96,
    gap: spacing.xs
  },
  thumbArt: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  thumbName: {
    color: colors.textSecondary,
    fontSize: 11
  },
  seeAll: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  seeAllCount: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600'
  },
  seeAllText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    flexShrink: 1
  }
})
