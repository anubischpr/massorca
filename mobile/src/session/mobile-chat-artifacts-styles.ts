import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

const PAGE_WIDTH = '48%'

/** The Artifacts list and viewer styles, kept apart from the components. */
export const artifactsStyles = StyleSheet.create({
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
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  filterChipSelected: {
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  filterLabel: {
    color: colors.textSecondary,
    fontSize: typography.metaSize
  },
  filterLabelSelected: {
    color: colors.textPrimary,
    fontWeight: '600'
  },
  filterCount: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily
  },
  pageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  pageTile: {
    width: PAGE_WIDTH,
    gap: spacing.xs
  },
  pageArt: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.bgPanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  },
  kindChip: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: typography.monoFamily,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  pageName: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    paddingHorizontal: spacing.xs
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  fileName: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: typography.bodySize
  },
  counts: {
    fontSize: 11,
    fontFamily: typography.monoFamily
  },
  added: {
    color: colors.gitDecorationAdded
  },
  removed: {
    color: colors.gitDecorationDeleted
  }
})
